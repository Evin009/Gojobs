package db

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// GetProfile returns every stored fact as key -> value, e.g.
//   { "email": "you@example.com", "phone": "+1 555 0100" }
// A map (not a slice) because callers look facts up by name.
func GetProfile() (map[string]string, error) {
	rows, err := pool.Query(context.Background(), "SELECT key, value FROM profile")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	profile := make(map[string]string)

	for rows.Next() {
		var key string
		var value string

		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}

		profile[key] = value
	}

	return profile, nil
}

// SaveProfile upserts every key it's given. Onboarding sends the whole form at
// once, so one call writes them all rather than a round trip per field.
//
// ON CONFLICT DO UPDATE means re-running onboarding edits the stored answers
// instead of failing on the unique key.
func SaveProfile(facts map[string]string) error {
	batch := &pgx.Batch{}

	for key, value := range facts {
		batch.Queue(
			"INSERT INTO profile (key, value) VALUES ($1, $2) "+
				"ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()",
			key, value,
		)
	}

	return pool.SendBatch(context.Background(), batch).Close()
}
