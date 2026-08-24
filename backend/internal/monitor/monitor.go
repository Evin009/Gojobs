package monitor

import (
	"fmt"
	"sync"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/github"
	"github.com/Evin009/Gojobs/backend/internal/greenhouse"
	"github.com/Evin009/Gojobs/backend/internal/jobposting"
)

// checkGreenhouse checks every company at the same time (one goroutine each),
// keeps only jobs matching any of `keywords`, saves new ones to the DB, and
// returns everything newly found — does NOT notify, caller combines results first.
func checkGreenhouse(companies []string, keywords []string) []jobposting.Posting {
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

			matches := greenhouse.FilterByKeywords(jobs, keywords)
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
func checkGitHub(keywords []string) []jobposting.Posting {
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

			matches := github.FilterByKeywords(listings, keywords)
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
func runOnce(companies []string, keywords []string) {
	var allNew []jobposting.Posting
	allNew = append(allNew, checkGreenhouse(companies, keywords)...)
	allNew = append(allNew, checkGitHub(keywords)...)

	if err := jobposting.NotifyNew(allNew); err != nil {
		fmt.Println("notify error:", err)
	}
}

// StartLoop runs one check immediately, then repeats forever on `interval`.
// Each repeat is launched via `go` so a slow check never delays the next tick.
func StartLoop(companies []string, keywords []string, interval time.Duration) {
	runOnce(companies, keywords)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		go runOnce(companies, keywords)
	}
}