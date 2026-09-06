package term

import (
	"regexp"
	"strings"
)

// Which intake a posting is for — "Summer 2027", "Fall 2026".
//
// Read from the title first and the description second: tracker repos put the
// term in the title, and it's the more reliable of the two. A description can
// mention several terms in passing.

const NotStated = "not_stated"

var seasons = map[string][]string{
	"spring": {"spring"},
	"summer": {"summer"},
	"fall":   {"fall", "autumn"},
	"winter": {"winter"},
}

// Season and year within a few words of each other — "Summer 2027",
// "Summer/Fall 2026", "2027 Summer Intern". Anything further apart is usually
// two unrelated facts in the same sentence.
var nearby = regexp.MustCompile(`(?i)(spring|summer|fall|autumn|winter)[^.\n]{0,20}(20\d{2})|(20\d{2})[^.\n]{0,20}(spring|summer|fall|autumn|winter)`)

// IDs returns every term a text refers to, comma-separated ("summer_2027"),
// or NotStated.
func Detect(title, description string) string {
	found := map[string]bool{}

	collect(title, found)

	// only consulted when the title says nothing — descriptions mention other
	// terms too often to trust as a primary source
	if len(found) == 0 {
		collect(description, found)
	}

	if len(found) == 0 {
		return NotStated
	}

	var ids []string
	for _, id := range Recent() {
		if found[id] {
			ids = append(ids, id)
		}
	}

	// a term outside the window we offer is still not "not stated"
	if len(ids) == 0 {
		return NotStated
	}

	return strings.Join(ids, ",")
}

// Winter and spring are one intake in North American hiring — a "Winter 2027"
// posting and a "Spring 2027" posting are the same job cycle, and keeping them
// apart produced two buckets holding the same listings.
func canonical(season, year string) string {
	if season == "winter" {
		season = "spring"
	}

	return season + "_" + year
}

func collect(text string, found map[string]bool) {
	for _, m := range nearby.FindAllStringSubmatch(text, -1) {
		season, year := m[1], m[2]
		if season == "" {
			season, year = m[4], m[3]
		}

		for id, names := range seasons {
			for _, name := range names {
				if strings.EqualFold(season, name) {
					found[canonical(id, year)] = true
				}
			}
		}
	}
}

// The intakes actually being hired for. Deliberately three, not a rolling
// window: a generated list produced Fall 2027 and Winter 2027 buckets that
// matched the same postings as Summer and Spring 2027, since job text mentions
// future terms in passing far more often than it advertises them.
//
// Revisit when the cycle moves on — this is a list to edit, not to compute.
func Recent() []string {
	return []string{"fall_2026", "spring_2027", "summer_2027"}
}

// Label turns "summer_2027" into "Summer 2027".
func Label(id string) string {
	if id == NotStated {
		return "Not stated"
	}

	parts := strings.SplitN(id, "_", 2)
	if len(parts) != 2 {
		return id
	}

	return strings.ToUpper(parts[0][:1]) + parts[0][1:] + " " + parts[1]
}

// Matches reports whether a job's stored terms pass the user's choice.
func Matches(stored string, wanted []string) bool {
	if len(wanted) == 0 {
		return true
	}

	if stored == "" {
		stored = NotStated
	}

	have := strings.Split(stored, ",")

	for _, want := range wanted {
		for _, id := range have {
			if id == want {
				return true
			}
		}
	}

	return false
}
