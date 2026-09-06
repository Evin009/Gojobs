package term

import (
	"fmt"
	"regexp"
	"strings"
	"time"
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

func collect(text string, found map[string]bool) {
	for _, m := range nearby.FindAllStringSubmatch(text, -1) {
		season, year := m[1], m[2]
		if season == "" {
			season, year = m[4], m[3]
		}

		for id, names := range seasons {
			for _, name := range names {
				if strings.EqualFold(season, name) {
					found[id+"_"+year] = true
				}
			}
		}
	}
}

// Recent lists the terms worth offering as filters: this season and the next
// five, so the list moves forward on its own instead of being edited every
// year.
func Recent() []string {
	order := []string{"spring", "summer", "fall", "winter"}

	now := time.Now()
	year := now.Year()
	index := int(now.Month()-1) / 3 // rough quarter -> season

	var ids []string
	for i := 0; i < 6; i++ {
		ids = append(ids, fmt.Sprintf("%s_%d", order[index], year))

		index++
		if index == len(order) {
			index = 0
			year++
		}
	}

	return ids
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
