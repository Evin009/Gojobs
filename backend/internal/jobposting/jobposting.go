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
	Source      string // "greenhouse" or "github"
	RepoName    string // only set when Source == "github", e.g. "SimplifyJobs/Summer2026-Internships"
}

func formatLine(n int, job Posting) string {
	return fmt.Sprintf("%d. *%s* — <%s|%s> (%s)\n", n, job.CompanyName, job.AbsoluteURL, job.Title, job.Location)
}

// NotifyNew sends one batched slack message summarizing all new jobs found in
// this check, grouped by source (and by repo within GitHub). Stays silent if
// newJobs is empty. Jobs keep the order they were found in (Greenhouse first,
// then GitHub repos in the order they were checked).
func NotifyNew(newJobs []Posting) error {
	if len(newJobs) == 0 {
		return nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("📋 *%d new jobs* (checked at %s)\n\n", len(newJobs), time.Now().Format("3:04 PM")))
	count := 0

	// greenhouse section
	var greenhouseJobs []Posting
	for _, job := range newJobs {
		if job.Source == "greenhouse" {
			greenhouseJobs = append(greenhouseJobs, job)
		}
	}
	if len(greenhouseJobs) > 0 {
		sb.WriteString("*Source: Greenhouse*\n")
		for _, job := range greenhouseJobs {
			count++
			sb.WriteString(formatLine(count, job))
		}
		sb.WriteString("\n")
	}

	// github section, grouped by repo — repoOrder keeps first-seen order since
	// map iteration order in Go is random and would scramble the "first found,
	// first shown" requirement
	var repoOrder []string
	byRepo := make(map[string][]Posting)
	for _, job := range newJobs {
		if job.Source != "github" {
			continue
		}
		if _, seen := byRepo[job.RepoName]; !seen {
			repoOrder = append(repoOrder, job.RepoName)
		}
		byRepo[job.RepoName] = append(byRepo[job.RepoName], job)
	}
	if len(repoOrder) > 0 {
		sb.WriteString("*Source: GitHub*\n")
		for _, repoName := range repoOrder {
			sb.WriteString(fmt.Sprintf("_repo: %s_\n", repoName))
			for _, job := range byRepo[repoName] {
				count++
				sb.WriteString(formatLine(count, job))
			}
		}
	}

	return slack.Send(sb.String())
}
