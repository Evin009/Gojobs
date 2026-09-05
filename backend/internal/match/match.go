package match

import (
	"regexp"
	"sync"
)

// Whole-word title matching, shared by every source so Greenhouse and GitHub
// can't drift apart on what counts as a match.

// Compiling a regex per keyword per job is wasteful when the keyword set is
// the same all run — cache them.
var (
	mu       sync.Mutex
	compiled = map[string]*regexp.Regexp{}
)

func pattern(keyword string) *regexp.Regexp {
	mu.Lock()
	defer mu.Unlock()

	if re, ok := compiled[keyword]; ok {
		return re
	}

	// \b so "ml" doesn't match "html" and "ai" doesn't match "email"
	re := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(keyword) + `\b`)
	compiled[keyword] = re

	return re
}

// Any reports whether the title contains any of the keywords.
//
// An empty keyword list means "no filter on this axis" and matches everything.
// The alternative — matching nothing — would silently stop all monitoring the
// moment a user cleared one group of checkboxes.
func Any(title string, keywords []string) bool {
	if len(keywords) == 0 {
		return true
	}

	for _, keyword := range keywords {
		if pattern(keyword).MatchString(title) {
			return true
		}
	}

	return false
}

// Title reports whether a job passes both axes: it must match any chosen
// discipline AND any chosen level. "SWE" plus "Internship" means SWE
// internships, not every SWE job and every internship.
func Title(title string, disciplines, levels []string) bool {
	return Any(title, disciplines) && Any(title, levels)
}

// Note: some boards put the level in the title, others only in the body.
// Titles are all the list endpoints give us, so that's what we match on.
