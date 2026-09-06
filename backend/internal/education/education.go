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

// Long enough not to collide with ordinary words, so a substring check is safe.
var phrases = map[string][]string{
	Bachelors: {
		"bachelor", "baccalaureate", "undergraduate",
		"4-year degree", "4 year degree", "four-year degree", "four year degree",
		"b.tech", "btech", "b.e.", "b.eng", "beng",
	},
	Masters: {
		"master", "postgraduate", "graduate degree",
		"m.tech", "mtech", "m.eng", "meng", "mba",
	},
	PhD: {
		"phd", "ph.d", "doctorate", "doctoral", "d.phil", "dphil",
	},
}

// Abbreviations, matched only as whole tokens: bare "ms" sits inside "systems"
// and "ba" inside "database".
//
// "ma" is deliberately absent — it's the state code in "Boston, MA", which
// turns up in job text constantly and has nothing to do with a degree.
var codes = map[string][]string{
	Bachelors: {"bs", "ba", "bsc", "b.s", "b.a", "b.s.", "b.a.", "bs/ba", "ba/bs"},
	Masters:   {"ms", "msc", "m.s", "m.s.", "ms/phd", "bs/ms"},
}

// "MS" is also Microsoft. Without this, "MS Office" and "MS Excel" — which
// appear in a large share of postings — would each read as a master's
// requirement.
var notADegree = regexp.MustCompile(`(?i)\bms[ .]?(office|excel|word|teams|sql|project|dynamics|azure|outlook|powerpoint|visio|access|windows|server)\b`)

var tags = regexp.MustCompile(`<[^>]+>`)

// Compiled once at start rather than lazily into a shared map: Save runs a
// goroutine per company, and a map written from several at once is a crash,
// not a slowdown.
var boundary = func() map[string]*regexp.Regexp {
	out := map[string]*regexp.Regexp{}

	for _, list := range codes {
		for _, code := range list {
			out[code] = regexp.MustCompile(`(?i)(^|[^a-z0-9.])` + regexp.QuoteMeta(code) + `([^a-z0-9]|$)`)
		}
	}

	return out
}()

func hasCode(text, code string) bool {
	re, ok := boundary[code]
	if !ok {
		return false
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

	// strip Microsoft product names before looking for "ms"
	text = notADegree.ReplaceAllString(text, " ")

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
