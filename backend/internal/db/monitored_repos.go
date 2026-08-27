package db

import "context"

// AddMonitoredRepo saves a repo's listings-feed URL to watch (no-op if already added).
func AddMonitoredRepo(url string) error {
	_, err := pool.Exec(context.Background(),
		"INSERT INTO monitored_repos (url) VALUES ($1) ON CONFLICT (url) DO NOTHING", url)

	return err
}

// IsRepoMonitored reports whether owner/repo is already being watched.
// Feed URLs always contain /owner/repo/ by construction, so a LIKE on that
// segment is enough — no need to know which feed convention was used.
func IsRepoMonitored(owner, repo string) (bool, error) {
	var exists bool

	err := pool.QueryRow(context.Background(),
		"SELECT EXISTS (SELECT 1 FROM monitored_repos WHERE url LIKE $1)",
		"%/"+owner+"/"+repo+"/%",
	).Scan(&exists)

	return exists, err
}

// GetMonitoredRepos returns every repo URL currently being watched.
func GetMonitoredRepos() ([]string, error) {
	rows, err := pool.Query(context.Background(), "SELECT url FROM monitored_repos")
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var urls []string
	for rows.Next() {
		var url string
		if err := rows.Scan(&url); err != nil {
			return nil, err
		}

		urls = append(urls, url)
	}

	return urls, nil
}
