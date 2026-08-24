package db

import "context"

// InsertJob saves a job posting, returns whether a row was actually inserted
// (false = duplicate url, skipped via ON CONFLICT DO NOTHING).
func InsertJob(company, role, description, url, source string) (bool, error) {
	tag, err := pool.Exec(context.Background(),
		"INSERT INTO jobs (company, role, description, url, source) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (url) DO NOTHING",
		company, role, description, url, source)

	return tag.RowsAffected() > 0, err
}
