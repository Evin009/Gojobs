package sponsorship

import (
	"html"
	"regexp"
	"strings"
)

// Whether a posting says it will sponsor a work visa.
//
// Three verdicts, and the third is the honest majority: most postings never
// mention it. Reading silence as either a yes or a no would be inventing an
// answer the company didn't give.
const (
	Yes       = "sponsors"
	No        = "no_sponsorship"
	NotStated = "not_stated"
	// Needs a judgement call a keyword can't make — the text mentions
	// sponsorship but not in a way that resolves to yes or no. Kept as its own
	// verdict so these can be sent to Claude later rather than being guessed.
	Unclear = "unclear"
)

// "Sponsor" on its own means nothing — postings advertise "company sponsored
// conferences" and "sponsored events". A match only counts near immigration
// words.
var context = regexp.MustCompile(`(?i)\b(visas?|immigration|work authori[sz]ation|employment authori[sz]ation|h-?1b|h1-b|green card|permanent residen\w*|opt|cpt|sponsorship)\b`)

// Refusals. Ordered before the positives because a posting that says both
// ("we sponsor for some roles, not this one") is refusing for this one.
var refusals = []string{
	"unable to sponsor",
	"not able to sponsor",
	"cannot sponsor",
	"can not sponsor",
	"do not sponsor",
	"does not sponsor",
	"will not sponsor",
	"not sponsor or take over",
	"no visa sponsorship",
	"not offer sponsorship",
	"not offer visa sponsorship",
	"not provide sponsorship",
	"not provide visa sponsorship",
	"not eligible for work authorization sponsorship",
	"not eligible for sponsorship",
	"without the need for sponsorship",
	"without requiring sponsorship",
	"not require sponsorship",
	"no sponsorship is available",
	"sponsorship is not available",
	"sponsorship not available",
	"not considering candidates requiring sponsorship",
}

var offers = []string{
	"visa sponsorship where applicable",
	"visa sponsorship is available",
	"sponsorship is available",
	"we sponsor",
	"we will sponsor",
	"will sponsor",
	"offer visa sponsorship",
	"provide visa sponsorship",
	"open to sponsoring",
	"willing to sponsor",
	"visa sponsorship provided",
	"sponsorship available",
	"h-1b sponsorship available",
}

var tags = regexp.MustCompile(`<[^>]+>`)

// Classify reads a job description. Returns one of the four verdicts above.
func Classify(description string) string {
	text := strings.ToLower(html.UnescapeString(tags.ReplaceAllString(description, " ")))
	text = strings.Join(strings.Fields(text), " ")

	if text == "" || !context.MatchString(text) {
		return NotStated
	}

	for _, phrase := range refusals {
		if strings.Contains(text, phrase) {
			return No
		}
	}

	for _, phrase := range offers {
		if strings.Contains(text, phrase) {
			return Yes
		}
	}

	// Mentions the subject without settling it. Not "not stated" — the posting
	// did say something, we just can't read it with a keyword.
	if strings.Contains(text, "sponsor") {
		return Unclear
	}

	return NotStated
}

// Matches reports whether a job's verdict passes the user's choice.
// No choice means no filter.
func Matches(stored string, wanted []string) bool {
	if len(wanted) == 0 {
		return true
	}

	// rows saved before this column existed
	if stored == "" {
		stored = NotStated
	}

	for _, want := range wanted {
		if stored == want {
			return true
		}
	}

	return false
}
