package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// GetRepoCheck returns a previously cached answer for owner/repo.
//
// Three outcomes, which the two booleans keep distinct:
//   found=false            — never checked; the caller must resolve it
//   found=true, feed=""    — checked, and this repo has no job feed
//   found=true, feed="..." — checked, and this is where its jobs live
func GetRepoCheck(owner, repo string) (feedURL string, found bool, err error) {
	// feed_url is nullable, so scan into a *string — a plain string would
	// error on NULL, which is exactly the "no feed" case we care about
	var url *string

	err = pool.QueryRow(context.Background(),
		"SELECT feed_url FROM repo_checks WHERE owner = $1 AND repo = $2",
		owner, repo,
	).Scan(&url)

	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}

	if url == nil {
		return "", true, nil
	}
	return *url, true, nil
}

// SaveRepoCheck caches the result of a lookup. Pass an empty feedURL to record
// "this repo has no job feed" — that negative is what keeps the extension from
// re-resolving ordinary repos on every visit.
func SaveRepoCheck(owner, repo, feedURL string) error {
	var url *string
	if feedURL != "" {
		url = &feedURL
	}

	_, err := pool.Exec(context.Background(),
		`INSERT INTO repo_checks (owner, repo, feed_url) VALUES ($1, $2, $3)
		 ON CONFLICT (owner, repo) DO UPDATE SET feed_url = $3, checked_at = now()`,
		owner, repo, url)

	return err
}
