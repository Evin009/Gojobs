package main

import (
	"net/http"
	"encoding/json"
)

type GreenhouseLocation struct {
	Name string `json:"name"`
}

type GreenhouseJob struct {
	ID          int                `json:"id"`
	Title       string             `json:"title"`
	AbsoluteURL string             `json:"absolute_url"`
	CompanyName string             `json:"company_name"`
	Location    GreenhouseLocation `json:"location"`
	UpdatedAt   string             `json:"updated_at"`
}

type GreenhouseResponse struct {
	Jobs []GreenhouseJob `json:"jobs"`
}


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