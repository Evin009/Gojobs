package main

import (
	"context"
)


// fn to insert github repo urls to the postgre db
func AddMonitoredRepo(url string) error {
	_, err := dbPool.Exec(context.Background(),
		"INSERT INTO monitored_repos (url) VALUES ($1) ON CONFLICT (url) DO NOTHING", url)

	return err

}

// select urls stored in db
// adding individual url to url list and return the list
func GetMonitoredRepos() ([]string, error) {
	rows, err := dbPool.Query(context.Background(), "SELECT url FROM monitored_repos")
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