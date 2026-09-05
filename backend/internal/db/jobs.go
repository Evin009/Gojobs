package db

import (
	"context"
	"time"
)

// InsertJob saves a job posting, returns whether a row was actually inserted
// (false = duplicate url, skipped via ON CONFLICT DO NOTHING).
func InsertJob(company, role, description, url, source string) (bool, error) {
	tag, err := pool.Exec(context.Background(),
		"INSERT INTO jobs (company, role, description, url, source) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (url) DO NOTHING",
		company, role, description, url, source)

	return tag.RowsAffected() > 0, err
}

// Job is one saved posting, shaped for the extension rather than for the
// monitors — this is what the panel lists.
type Job struct {
	Company   string    `json:"company"`
	Role      string    `json:"role"`
	URL       string    `json:"url"`
	Source    string    `json:"source"`
	CreatedAt time.Time `json:"created_at"`
}

// TODO (you): return the most recently found jobs, newest first.
//
//  1. SELECT company, role, url, source, created_at FROM jobs
//  2. ORDER BY created_at DESC LIMIT $1
//  3. scan each row into a Job, append to a slice, return it
//
// Take the limit as an argument rather than fetching everything: this table
// grows forever, and the panel only ever shows a screenful.
func ListJobs(limit int) ([]Job, error) {
	rows, err := pool.Query(context.Background(), 
	`SELECT company, role, url, source, created_at FROM jobs 
	ORDER BY created_at DESC LIMIT $1`, limit)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var jobs []Job

	for rows.Next(){
		var job Job

		if err := rows.Scan(&job.Company, &job.Role, &job.URL, &job.Source, &job.CreatedAt); err != nil {
			return nil, err
		}

		jobs = append(jobs, job)

	}
	return jobs, nil
}

// TODO (you): total jobs found, for the dashboard count.
//
//	One row, one value — pool.QueryRow(...).Scan(&count) is enough.
func CountJobs() (int, error) {
	var count int
	err := pool.QueryRow(context.Background(), "SELECT count(*) FROM jobs").Scan(&count)

	if err != nil {
		return 0, err
	}

	return count, nil
}
