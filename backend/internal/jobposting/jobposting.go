package jobposting

import (
	"fmt"
	"strings"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/slack"
)

// Posting is the common shape every source (Greenhouse, GitHub, ...) converts
// into before saving/notifying, so the rest of the pipeline doesn't care which
// source a job came from.
type Posting struct {
	CompanyName string
	Title       string
	AbsoluteURL string
	Location    string
	Source      string
}

// NotifyNew sends one batched slack message summarizing all new jobs found in
// this check. Stays silent if newJobs is empty.
func NotifyNew(newJobs []Posting) error {
	if len(newJobs) == 0 {
		return nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("📋 *%d new jobs* (checked at %s)\n", len(newJobs), time.Now().Format("3:04 PM")))

	for i, job := range newJobs {
		sb.WriteString(fmt.Sprintf("%d. *%s* — <%s|%s> (%s)\n", i+1, job.CompanyName, job.AbsoluteURL, job.Title, job.Location))
	}

	return slack.Send(sb.String())
}
