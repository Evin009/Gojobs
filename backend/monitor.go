package main

import (
	"fmt"
	"sync"
	"time"
)

// checks all companies concurrently, sends one combined slack summary
func MonitorGreenhouseCompanies(companies []string, keyword string) {
	resultsChan := make(chan []GreenhouseJob, len(companies))
	var wg sync.WaitGroup

	for _, company := range companies {
		wg.Add(1)
		go func(company string) {
			defer wg.Done()

			jobs, err := FetchGreenhouseJobs(company)
			if err != nil {
				fmt.Println("fetch error for", company, ":", err)
				resultsChan <- nil
				return
			}

			matches := filterJobsKeyword(jobs, keyword)
			newJobs := SaveGreenhouseJobs(matches)
			resultsChan <- newJobs
		}(company)
	}

	wg.Wait()
	close(resultsChan)

	var allNew []GreenhouseJob
	for jobs := range resultsChan {
		allNew = append(allNew, jobs...)
	}

	if err := NotifyNewJobs(allNew); err != nil {
		fmt.Println("notify error:", err)
	}
}

// repeats MonitorGreenhouseCompanies on a fixed interval, forever
func StartMonitorLoop(companies []string, keyword string, interval time.Duration) {
	MonitorGreenhouseCompanies(companies, keyword)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		go MonitorGreenhouseCompanies(companies, keyword)
	}
}
