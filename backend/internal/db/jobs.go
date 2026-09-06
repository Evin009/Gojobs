package db

import (
	"context"
	"time"
)

// InsertJob saves a job posting, returns whether a row was actually inserted
// (false = duplicate url, skipped via ON CONFLICT DO NOTHING).
func InsertJob(company, role, description, url, source, location, education, term string) (bool, error) {
	tag, err := pool.Exec(context.Background(),
		"INSERT INTO jobs (company, role, description, url, source, location, education, term) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (url) DO NOTHING",
		company, role, description, url, source, location, education, term)

	return tag.RowsAffected() > 0, err
}

// Job is one saved posting, shaped for the extension rather than for the
// monitors — this is what the panel lists.
type Job struct {
	Company   string    `json:"company"`
	Role      string    `json:"role"`
	URL       string    `json:"url"`
	Source    string    `json:"source"`
	Location  string    `json:"location"`
	Education string    `json:"education"`
	Term      string    `json:"term"`
	CreatedAt time.Time `json:"created_at"`
}

// TODO (you): return the most recently found jobs, newest first.
//
//  1. SELECT company, role, url, source, location, education, term, created_at FROM jobs
//  2. ORDER BY created_at DESC LIMIT $1
//  3. scan each row into a Job, append to a slice, return it
//
// Take the limit as an argument rather than fetching everything: this table
// grows forever, and the panel only ever shows a screenful.
func ListJobs(limit int) ([]Job, error) {
	rows, err := pool.Query(context.Background(),
		`SELECT company, role, url, source, location, education, term, created_at FROM jobs 
	ORDER BY created_at DESC LIMIT $1`, limit)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var jobs []Job

	for rows.Next() {
		var job Job

		if err := rows.Scan(&job.Company, &job.Role, &job.URL, &job.Source, &job.Location, &job.Education, &job.Term, &job.CreatedAt); err != nil {
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

// ListJobsSince returns jobs saved at or after `since`, newest first.
//
// No LIMIT here on purpose: the caller filters these against the user's
// current role settings, and cutting the list before filtering would drop
// matches that sit below the cut.
func ListJobsSince(since time.Time) ([]Job, error) {
	rows, err := pool.Query(context.Background(),
		`SELECT company, role, url, source, location, education, term, created_at FROM jobs
		 WHERE created_at >= $1 ORDER BY created_at DESC`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []Job

	for rows.Next() {
		var job Job
		if err := rows.Scan(&job.Company, &job.Role, &job.URL, &job.Source, &job.Location, &job.Education, &job.Term, &job.CreatedAt); err != nil {
			return nil, err
		}

		jobs = append(jobs, job)
	}

	return jobs, rows.Err()
}

// BackfillTerm fills in the term for a job we already have.
func BackfillTerm(url, value string) error {
	if value == "" {
		return nil
	}

	_, err := pool.Exec(context.Background(),
		"UPDATE jobs SET term = $2 WHERE url = $1 AND term = ''", url, value)

	return err
}

// BackfillEducation fills in education for a job we already have, for the same
// reason BackfillLocation exists: duplicates are skipped, so a row saved before
// this column would never gain one.
func BackfillEducation(url, education string) error {
	if education == "" {
		return nil
	}

	_, err := pool.Exec(context.Background(),
		"UPDATE jobs SET education = $2 WHERE url = $1 AND education = ''",
		url, education)

	return err
}

// BackfillLocation fills in a location for a job we already have.
//
// Needed because InsertJob skips duplicates entirely: a posting saved before
// the location column existed would never get one, however many times
// monitoring saw it again. Only writes when the stored value is empty, so a
// real location is never overwritten by a blank one.
func BackfillLocation(url, location string) error {
	if location == "" {
		return nil
	}

	_, err := pool.Exec(context.Background(),
		"UPDATE jobs SET location = $2 WHERE url = $1 AND location = ''",
		url, location)

	return err
}
