package main

import "context"

// fn to insert jobs to the postgre db
func InsertJob(company, role, description, url, source string) (bool, error) {
	tag, err := dbPool.Exec(context.Background(),
		"INSERT INTO jobs (company, role, description, url, source) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (url) DO NOTHING",
		company, role, description, url, source)
	
	return tag.RowsAffected() > 0, err
}
