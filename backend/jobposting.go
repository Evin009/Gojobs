package main

import (
	"fmt"
	"strings"
	"time"
)

// common shape both Greenhouse and GitHub listings convert into before
// saving/notifying, so the rest of the pipeline doesn't care which source a job came from
type JobPosting struct {
	CompanyName string
	Title       string
	AbsoluteURL string
	Location    string
	Source      string
}

// send one batched slack message summarizing all new jobs found in this check
func NotifyNewJobs(newJobs []JobPosting) error {
	if len(newJobs) == 0 {
		return nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("📋 *%d new jobs* (checked at %s)\n", len(newJobs), time.Now().Format("3:04 PM")))

	for i, job := range newJobs {
		sb.WriteString(fmt.Sprintf("%d. *%s* — <%s|%s> (%s)\n", i+1, job.CompanyName, job.AbsoluteURL, job.Title, job.Location))
	}

	return SendSlackMessage(sb.String())
}
