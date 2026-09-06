// Re-derives education and term for every job we already hold a description
// for.
//
// Stored verdicts don't change on their own when the classifier improves, and
// the classifier improves often — each new phrasing found in real postings is
// a pattern added. Run this after touching internal/education or internal/term:
//
//	go run ./cmd/reclassify
package main

import (
	"context"
	"fmt"

	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/education"
	"github.com/Evin009/Gojobs/backend/internal/term"
)

func main() {
	pool := db.Connect()
	ctx := context.Background()

	rows, err := pool.Query(ctx,
		`SELECT url, role, description FROM jobs WHERE description <> ''`)
	if err != nil {
		panic(err)
	}

	type job struct{ url, role, description string }

	// Read everything first: the update below uses the same pool, and holding
	// a result set open while writing through it can deadlock on a small pool.
	var jobs []job

	for rows.Next() {
		var j job
		if err := rows.Scan(&j.url, &j.role, &j.description); err != nil {
			panic(err)
		}

		jobs = append(jobs, j)
	}

	rows.Close()

	changed := 0

	for _, j := range jobs {
		levels := education.Levels(j.description)
		intake := term.Detect(j.role, j.description)

		tag, err := pool.Exec(ctx,
			`UPDATE jobs SET education = $2, term = $3
			 WHERE url = $1 AND (education <> $2 OR term <> $3)`,
			j.url, levels, intake)
		if err != nil {
			fmt.Println("update:", err)
			continue
		}

		changed += int(tag.RowsAffected())
	}

	fmt.Printf("re-read %d descriptions, %d rows changed\n", len(jobs), changed)
}
