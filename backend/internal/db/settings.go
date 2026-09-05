package db

import (
	"context"
	"strings"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/roles"
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

	for rows.Next() {
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
	return pool.SendBatch(context.Background(), batch).Close()
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

// Splits a comma-separated setting into trimmed, non-empty entries.
func listSetting(settings map[string]string, key string) []string {
	var out []string

	for _, entry := range strings.Split(settings[key], ",") {
		if trimmed := strings.TrimSpace(entry); trimmed != "" {
			out = append(out, trimmed)
		}
	}

	return out
}

// chosen discipline AND ANY chosen level. An empty list means "no filter on
// this axis" — not "match nothing", which would silently stop all monitoring.
func GetRoleKeywords() (disciplines []string, levels []string, err error) {
	settings, err := GetSettings()
	if err != nil {
		return nil, nil, err
	}

	disciplines = roles.Expand(roles.Disciplines, listSetting(settings, "roles"))
	levels = roles.Expand(roles.Levels, listSetting(settings, "levels"))

	return disciplines, levels, nil
}

// The clock the daily count resets on. Fixed rather than the server's local
// zone, so the number means the same thing wherever this runs.
var resetZone = mustLoad("America/New_York")

func mustLoad(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		// UTC is wrong but survivable; a missing tzdata shouldn't stop the
		// server from starting
		return time.UTC
	}

	return loc
}

// StartOfDay is midnight in the reset zone — the point the daily job count
// goes back to zero.
func StartOfDay() time.Time {
	now := time.Now().In(resetZone)

	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, resetZone)
}

// LastChecked returns when monitoring last completed a run, or the zero time
// if it hasn't yet.
func LastChecked() (time.Time, error) {
	settings, err := GetSettings()
	if err != nil {
		return time.Time{}, err
	}

	stamp := settings["last_checked"]
	if stamp == "" {
		return time.Time{}, nil
	}

	return time.Parse(time.RFC3339, stamp)
}

// MarkChecked records the end of a monitoring run.
func MarkChecked() error {
	return SaveSettings(map[string]string{
		"last_checked": time.Now().UTC().Format(time.RFC3339),
	})
}
