package main

import (
	"fmt"
	"sync"
	"time"
)

// MonitorGreenhouseCompanies checks every company in `companies` at the same time
// (one goroutine each), keeps only jobs matching any of `keywords`, saves new ones
// to the DB, then sends ONE combined slack summary for everything found this run.
// If nothing new matched, NotifyNewJobs stays silent (no empty pings).
func MonitorGreenhouseCompanies(companies []string, keywords []string) {
	// buffered so each goroutine can drop its result in without waiting for a reader
	resultsChan := make(chan []GreenhouseJob, len(companies))
	var wg sync.WaitGroup

	for _, company := range companies {
		wg.Add(1)
		// company passed as a param so each goroutine gets its own copy,
		// not a shared reference to the loop variable
		go func(company string) {
			defer wg.Done()

			jobs, err := FetchGreenhouseJobs(company)
			if err != nil {
				fmt.Println("fetch error for", company, ":", err)
				resultsChan <- nil
				return
			}

			matches := filterJobsKeywords(jobs, keywords)
			newJobs := SaveGreenhouseJobs(matches)
			resultsChan <- newJobs
		}(company)
	}

	wg.Wait() // block until every goroutine above has sent its result
	close(resultsChan)

	// combine every company's results into one slice before notifying
	var allNew []GreenhouseJob
	for jobs := range resultsChan {
		allNew = append(allNew, jobs...)
	}

	if err := NotifyNewJobs(allNew); err != nil {
		fmt.Println("notify error:", err)
	}
}

// StartMonitorLoop runs one check immediately, then repeats forever on `interval`.
// Each repeat is launched via `go` so a slow check never delays the next tick.
func StartMonitorLoop(companies []string, keywords []string, interval time.Duration) {
	MonitorGreenhouseCompanies(companies, keywords)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		go MonitorGreenhouseCompanies(companies, keywords)
	}
}
