package monitor

import (
	"fmt"
	"sync"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/greenhouse"
	"github.com/Evin009/Gojobs/backend/internal/jobposting"
	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/github"
)

// Greenhouse checks every company in `companies` at the same time (one
// goroutine each), keeps only jobs matching any of `keywords`, saves new ones
// to the DB, then sends ONE combined slack summary for everything found this run.
func Greenhouse(companies []string, keywords []string) {
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

	if err := jobposting.NotifyNew(allNew); err != nil {
		fmt.Println("notify error:", err)
	}
}



func GitHub(keywords []string) {
	// get the urls list
	repoURLs, err := db.GetMonitoredRepos()
	if err != nil {
		fmt.Println("get monitored repos error:", err)
		return
	}

	resultsChan := make(chan []jobposting.Posting, len(repoURLs))
	var wg sync.WaitGroup

	// looping url lists and fetching jobs
	for _, repoURL := range repoURLs {
		wg.Add(1)
		go func(repoURL string){
			defer wg.Done()
			
			listings, err := github.FetchListings(repoURL)
			if err != nil {
				fmt.Println("fetch error for", repoURL, ":", err)
				resultsChan <- nil
				return
			}
			
			// filtering + saving to db and finding newJobs added		
			matches := github.FilterByKeywords(listings, keywords)
			newJobs := github.Save(matches)
			resultsChan <- newJobs
		}(repoURL)
	
	}

	wg.Wait()
	close(resultsChan)

	// store all the jobs within the channel onto a arr of Posting type
	var allNew []jobposting.Posting
	for jobs := range resultsChan {
		allNew = append(allNew, jobs...)
	}
	
	// post onto slack
	if err := jobposting.NotifyNew(allNew); err != nil {
		fmt.Println("notify error:", err)
	}

}



// StartLoop runs one check immediately, then repeats forever on `interval`.
// Each repeat is launched via `go` so a slow check never delays the next tick.
func StartLoop(companies []string, keywords []string, interval time.Duration) {
	Greenhouse(companies, keywords)
	GitHub(keywords)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		go Greenhouse(companies, keywords)
		go GitHub(keywords)
	}
}


