package monitor

import (
	"fmt"
	"sync"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/education"
	"github.com/Evin009/Gojobs/backend/internal/github"
	"github.com/Evin009/Gojobs/backend/internal/greenhouse"
	"github.com/Evin009/Gojobs/backend/internal/jobposting"
	"github.com/Evin009/Gojobs/backend/internal/jobsource"
	"github.com/Evin009/Gojobs/backend/internal/term"
)

// checkGreenhouse checks every company at the same time (one goroutine each),
// keeps only jobs matching any of `keywords`, saves new ones to the DB, and
// returns everything newly found — does NOT notify, caller combines results first.
func checkGreenhouse(companies []string, disciplines, levels []string) []jobposting.Posting {
	resultsChan := make(chan []jobposting.Posting, len(companies))
	var wg sync.WaitGroup

	for _, company := range companies {
		wg.Add(1)
		go func(company string) {
			defer wg.Done()

			jobs, err := greenhouse.FetchJobs(company)
			if err != nil {
				fmt.Println("fetch error for", company, ":", err)
				resultsChan <- nil
				return
			}

			matches := greenhouse.FilterByRoles(jobs, disciplines, levels)
			newJobs := greenhouse.Save(matches)
			resultsChan <- newJobs
		}(company)
	}

	wg.Wait()
	close(resultsChan)

	var allNew []jobposting.Posting
	for jobs := range resultsChan {
		allNew = append(allNew, jobs...)
	}

	return allNew
}

// checkGitHub checks every monitored repo at the same time, keeps only listings
// matching any of `keywords`, saves new ones to the DB, and returns everything
// newly found (each tagged with its repo name) — does NOT notify.
func checkGitHub(disciplines, levels []string) []jobposting.Posting {
	repoURLs, err := db.GetMonitoredRepos()
	if err != nil {
		fmt.Println("get monitored repos error:", err)
		return nil
	}

	resultsChan := make(chan []jobposting.Posting, len(repoURLs))
	var wg sync.WaitGroup

	for _, repoURL := range repoURLs {
		wg.Add(1)
		go func(repoURL string) {
			defer wg.Done()

			listings, err := github.FetchListings(repoURL)
			if err != nil {
				fmt.Println("fetch error for", repoURL, ":", err)
				resultsChan <- nil
				return
			}

			matches := github.FilterByRoles(listings, disciplines, levels)
			repoName := github.RepoNameFromURL(repoURL)
			newJobs := github.Save(matches, repoName)
			resultsChan <- newJobs
		}(repoURL)
	}

	wg.Wait()
	close(resultsChan)

	var allNew []jobposting.Posting
	for jobs := range resultsChan {
		allNew = append(allNew, jobs...)
	}

	return allNew
}

// runOnce checks Greenhouse then GitHub (each internally concurrent already),
// combines everything newly found, and sends ONE grouped slack summary.
func runOnce() {
	// Settings are read every run, so an edit in the extension is picked up at
	// the next tick without a restart.
	companies, err := db.GetCompanies()
	if err != nil {
		fmt.Println("read companies error:", err)
	}

	disciplines, levels, err := db.GetRoleKeywords()
	if err != nil {
		fmt.Println("read roles error:", err)
	}

	var allNew []jobposting.Posting
	allNew = append(allNew, checkGreenhouse(companies, disciplines, levels)...)
	allNew = append(allNew, checkGitHub(disciplines, levels)...)

	if err := jobposting.NotifyNew(allNew); err != nil {
		fmt.Println("notify error:", err)
	}

	// A slice of the backlog each run: it drains over a few cycles instead of
	// firing thousands of requests at once.
	enrich(150)

	// recorded after the work, so "last checked" means a completed run
	if err := db.MarkChecked(); err != nil {
		fmt.Println("mark checked error:", err)
	}
}

// StartLoop runs one check immediately, then repeats forever on `interval`.
// Each repeat is launched via `go` so a slow check never delays the next tick.
func StartLoop(interval time.Duration) {
	runOnce()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		go runOnce()
	}
}

// enrich fills in descriptions for tracker jobs, which arrive with a title and
// a link and nothing else.
//
// Runs after the fetch, on a slice of the backlog at a time: these are
// third-party APIs and there's no reason to hammer them. Jobs are grouped by
// company so one request covers a whole board.
func enrich(limit int) {
	pending, err := db.JobsNeedingDetail(limit)
	if err != nil {
		fmt.Println("enrich: read pending:", err)
		return
	}

	// company -> job id -> url, so one fetch can update every job on a board
	boards := map[jobsource.Ref]map[string]string{}

	for _, job := range pending {
		ref, ok := jobsource.Parse(job.URL)
		if !ok {
			continue // bespoke careers site, nothing to call
		}

		board := jobsource.Ref{Provider: ref.Provider, Company: ref.Company}
		if boards[board] == nil {
			boards[board] = map[string]string{}
		}

		boards[board][ref.JobID] = job.URL
	}

	filled := 0

	for board, wanted := range boards {
		descriptions, err := jobsource.Descriptions(board.Provider, board.Company)
		if err != nil {
			continue
		}

		for id, url := range wanted {
			text := descriptions[id]
			if text == "" {
				continue
			}

			if err := db.SaveJobDetail(url, text, education.Levels(text), term.Detect("", text)); err != nil {
				fmt.Println("enrich: save:", err)
				continue
			}

			filled++
		}
	}

	if filled > 0 {
		fmt.Printf("enriched %d job descriptions from %d boards\n", filled, len(boards))
	}
}
