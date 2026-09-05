package db

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Settings the user controls from the extension. Stored key-value, so adding
// one later needs no migration.
func GetSettings() (map[string]string, error) {
	rows, err := pool.Query(context.Background(), "SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := make(map[string]string)

	for rows.Next(){
		var key string
		var value string

		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		
		settings[key] = value
	}

	return settings, nil
	
}

func SaveSettings(values map[string]string) error {
	batch := &pgx.Batch{}

	for key, value := range values {
		batch.Queue(
			"INSERT INTO settings (key, value) VALUES ($1, $2) "+
				"ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()",
			key, value,
		)
	}
	return  pool.SendBatch(context.Background(), batch).Close()
}

// Helpers so callers don't each re-parse the same TEXT values.

// GetCompanies returns the Greenhouse companies to poll. Empty entries are
// dropped — a stray comma in the settings field shouldn't become a request to
// a company named "".
func GetCompanies() ([]string, error) {
	settings, err := GetSettings()
	if err != nil {
		return nil, err
	}

	var companies []string
	for _, name := range strings.Split(settings["companies"], ",") {
		if trimmed := strings.TrimSpace(name); trimmed != "" {
			companies = append(companies, trimmed)
		}
	}

	return companies, nil
}

// SlackTarget returns the webhook to post to, or "" when notifications are off
// or unconfigured. One call, so callers can't check the toggle and forget the
// webhook, or the other way round.
func SlackTarget() (string, error) {
	settings, err := GetSettings()
	if err != nil {
		return "", err
	}

	if settings["slack_enabled"] != "true" {
		return "", nil
	}

	return strings.TrimSpace(settings["slack_webhook"]), nil
}
