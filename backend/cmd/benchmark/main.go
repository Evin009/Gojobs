// Standalone benchmark: measures real speedup from fetching Greenhouse job
// boards concurrently (goroutines) vs sequentially (one at a time). Only
// hits the public Greenhouse API — never touches the database, so it's safe
// to run repeatedly with no dedupe/side effects.
package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/greenhouse"
)

// real companies with live Greenhouse boards, same ones used in production
// monitoring (main.go) plus a few more to get a meaningful sample size
var companies = []string{
	"databricks", "robinhood", "cloudflare", "stripe", "airbnb",
	"figma", "brex", "coinbase", "block", "discord",
}

func sequential() (time.Duration, int) {
	start := time.Now()
	total := 0
	for _, c := range companies {
		jobs, err := greenhouse.FetchJobs(c)
		if err != nil {
			fmt.Println("fetch error for", c, ":", err)
			continue
		}
		total += len(jobs)
	}
	return time.Since(start), total
}

func concurrent() (time.Duration, int) {
	start := time.Now()
	var wg sync.WaitGroup
	counts := make([]int, len(companies))

	for i, c := range companies {
		wg.Add(1)
		go func(i int, c string) {
			defer wg.Done()
			jobs, err := greenhouse.FetchJobs(c)
			if err != nil {
				fmt.Println("fetch error for", c, ":", err)
				return
			}
			counts[i] = len(jobs)
		}(i, c)
	}
	wg.Wait()

	total := 0
	for _, n := range counts {
		total += n
	}
	return time.Since(start), total
}

func main() {
	fmt.Printf("Benchmarking %d companies...\n\n", len(companies))

	seqDur, seqTotal := sequential()
	fmt.Printf("Sequential: %v (%d jobs fetched)\n", seqDur, seqTotal)

	conDur, conTotal := concurrent()
	fmt.Printf("Concurrent: %v (%d jobs fetched)\n", conDur, conTotal)

	speedup := float64(seqDur) / float64(conDur)
	pctFaster := (1 - float64(conDur)/float64(seqDur)) * 100
	fmt.Printf("\nSpeedup: %.2fx (%.1f%% faster)\n", speedup, pctFaster)
}
