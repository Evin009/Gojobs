package main

import (
	"net/http"
	"encoding/json"
	"strings"
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

// filter jobs in arr with specific keyword
func filterJobsKeyword(jobs []GreenhouseJob, keyword string) []GreenhouseJob {
	var matches []GreenhouseJob
	for _, job := range jobs{
		if strings.Contains(strings.ToLower(job.Title),strings.ToLower(keyword)){
			matches = append(matches, job)
		}	
	}

	return matches

}