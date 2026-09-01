package db

import "context"

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
