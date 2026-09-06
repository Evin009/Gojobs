package education

import (
	"html"
	"regexp"
	"strings"
)

// Education requirements read out of a job description.
//
// Every level mentioned is recorded, not just the highest: "Bachelor's
// required, Master's preferred" is open to both, and a student with either
// should see it.
const (
	Bachelors = "bachelors"
	Masters   = "masters"
	PhD       = "phd"
	// NotStated is its own value, not an absence. Most descriptions never
	// mention a degree, so treating that as "matches everything" would make
	// the filter useless — the user picks whether they want those.
	NotStated = "not_stated"
)

// Phrases are matched as substrings; they're long enough not to collide.
var phrases = map[string][]string{
	Bachelors: {"bachelor", "undergraduate degree", "4-year degree", "four year degree"},
	Masters:   {"master", "graduate degree"},
	PhD:       {"phd", "ph.d", "doctorate", "doctoral"},
}

// Abbreviations need word boundaries: bare "ms" appears inside "systems" and
// "forms", "ba" inside "database".
var codes = map[string][]string{
	Bachelors: {"bs", "ba", "b.s.", "b.a.", "bsc"},
	Masters:   {"ms", "ma", "m.s.", "m.a.", "msc"},
}

var (
	tags     = regexp.MustCompile(`<[^>]+>`)
	boundary = map[string]*regexp.Regexp{}
)

func hasCode(text, code string) bool {
	re, ok := boundary[code]
	if !ok {
		re = regexp.MustCompile(`(?i)(^|[^a-z0-9])` + regexp.QuoteMeta(code) + `([^a-z0-9]|$)`)
		boundary[code] = re
	}

	return re.MatchString(text)
}

// Levels returns the education levels a description mentions, as a
// comma-separated string ready to store. Empty description or no mention at
// all gives NotStated.
func Levels(description string) string {
	text := strings.ToLower(html.UnescapeString(tags.ReplaceAllString(description, " ")))
	if strings.TrimSpace(text) == "" {
		return NotStated
	}

	var found []string

	// fixed order so the stored value is stable — a set built by map iteration
	// would come out differently each run and look like a change
	for _, level := range []string{Bachelors, Masters, PhD} {
		if mentions(text, level) {
			found = append(found, level)
		}
	}

	if len(found) == 0 {
		return NotStated
	}

	return strings.Join(found, ",")
}

func mentions(text, level string) bool {
	for _, phrase := range phrases[level] {
		if strings.Contains(text, phrase) {
			return true
		}
	}

	for _, code := range codes[level] {
		if hasCode(text, code) {
			return true
		}
	}

	return false
}

// Matches reports whether a job's stored levels pass the user's choice.
// No choice means no filter.
func Matches(stored string, wanted []string) bool {
	if len(wanted) == 0 {
		return true
	}

	// a row saved before this existed has nothing stored; treat it the same as
	// a description that never mentioned a degree
	if stored == "" {
		stored = NotStated
	}

	have := strings.Split(stored, ",")

	for _, want := range wanted {
		for _, level := range have {
			if level == want {
				return true
			}
		}
	}

	return false
}
