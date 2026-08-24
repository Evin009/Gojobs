package main

import (
	"fmt"
	"net/http"
	"encoding/json"
	"regexp"
	"strings"
	"time"
)

type GreenhouseLocation struct { // lcn := GreenhouseLocation{Name: "San Fransisco"}
	Name string `json:"name"`
}

// api response structure
type GreenhouseJob struct {
	ID          int                `json:"id"`
	Title       string             `json:"title"`
	AbsoluteURL string             `json:"absolute_url"`
	CompanyName string             `json:"company_name"`
	Location    GreenhouseLocation `json:"location"`
	UpdatedAt   string             `json:"updated_at"`
}

/* EXAMPLE JOB
job := GreenhouseJob{
	ID:          8130725,
	Title:       "Account Executive",
	AbsoluteURL: "https://stripe.com/jobs/8130725",
	CompanyName: "Stripe",
	Location: GreenhouseLocation{
		Name: "San Francisco",
	},
	UpdatedAt: "2026-08-19T14:02:07-04:00",
}
*/


// list called Jobs - of api responses
type GreenhouseResponse struct {
	Jobs []GreenhouseJob `json:"jobs"`
}

// fetch jobs from greehouse with company name and return arr of jobs
func FetchGreenhouseJobs(company string) ([]GreenhouseJob, error){
	url := "https://boards-api.greenhouse.io/v1/boards/" + company + "/jobs"

	resp, err  := http.Get(url)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var result GreenhouseResponse
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, err
	}

	return result.Jobs, nil


}

// keeps jobs whose title whole-word-matches ANY of the given keywords (not substring).
// e.g. keywords=["intern","internship"] matches "Software Engineer Intern" and
// "Marketing Internship" but not "Internal Audit".
func filterJobsKeywords(jobs []GreenhouseJob, keywords []string) []GreenhouseJob {
	var matches []GreenhouseJob

	for _, job := range jobs {
		for _, keyword := range keywords {
			// \b = word boundary, so "intern" won't match inside "internal"
			pattern := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(keyword) + `\b`)
			if pattern.MatchString(job.Title) {
				matches = append(matches, job)
				break // already matched this job, no need to check remaining keywords
			}
		}
	}

	return matches
}


// insert greenshouse matched jobs to db
func SaveGreenhouseJobs(jobs []GreenhouseJob) []GreenhouseJob {
	var newJobs []GreenhouseJob

	for _, job := range jobs {
		company := job.CompanyName
		role := job.Title
		description := ""
		url := job.AbsoluteURL
		source := "greenhouse"
		
		// return insrted = true (if new addiiton)
		inserted, err := InsertJob(company, role, description, url, source)
		if err != nil {		
			fmt.Println(err)
			continue
		}
		
		// send data to slack
		if inserted {
			newJobs = append(newJobs, job)
		}
	}

	return newJobs
}

// send one batched slack message summarizing all new jobs found in this check
func NotifyNewJobs(newJobs []GreenhouseJob) error {
	if len(newJobs) == 0 {
		return nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("📋 *%d new jobs* (checked at %s)\n", len(newJobs), time.Now().Format("3:04 PM")))

	for i, job := range newJobs {
		sb.WriteString(fmt.Sprintf("%d. *%s* — <%s|%s> (%s)\n", i+1, job.CompanyName, job.AbsoluteURL, job.Title, job.Location.Name))
	}

	return SendSlackMessage(sb.String())
}