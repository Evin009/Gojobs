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

// filter jobs in arr with specific keyword (whole-word match, not substring)
func filterJobsKeyword(jobs []GreenhouseJob, keyword string) []GreenhouseJob {
	pattern := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(keyword) + `\b`)

	var matches []GreenhouseJob
	for _, job := range jobs {
		if pattern.MatchString(job.Title) {
			matches = append(matches, job)
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
		sb.WriteString(fmt.Sprintf("%d. *%s* — <%s|%s>\n", i + 1, job.CompanyName, job.AbsoluteURL, job.Title))
	}

	return SendSlackMessage(sb.String())
}