package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// A base resume is the one with no job_id — it isn't tailored to anything yet.
// Every tailored version is a separate row pointing at its job.

// SaveBaseResume stores a new base resume and returns its id. Old ones are
// kept, not overwritten: a past application should always be able to show the
// exact resume that was sent.
func SaveBaseResume(content string) (string, error) {
	var id string

	err := pool.QueryRow(context.Background(),
		"INSERT INTO resumes (content) VALUES ($1) RETURNING id",
		content,
	).Scan(&id)

	return id, err
}

// GetBaseResume returns the most recent untailored resume, or "" if the user
// hasn't uploaded one yet. Empty is a normal state, not an error — the caller
// decides whether to prompt for one.
func GetBaseResume() (string, error) {
	var content string

	err := pool.QueryRow(context.Background(),
		"SELECT content FROM resumes WHERE job_id IS NULL ORDER BY created_at DESC LIMIT 1",
	).Scan(&content)

	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}

	return content, err
}
