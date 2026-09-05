package location

import "strings"

// Job boards write locations as free text — "New York, NY", "Toronto, ON,
// Canada", "Remote - US". There's no country field to read, so country is
// inferred from what's in the string.

// Region ids match the ones stored in settings.
const (
	US     = "us"
	Canada = "canada"
	// Other means we recognised the place and it isn't US or Canada. Distinct
	// from Unknown, which means we couldn't tell — only one of those is a real
	// answer, and they're filtered differently.
	Other   = "other"
	Unknown = "unknown"
)

// Two-letter codes are checked as whole words only: "in" is Indiana and also
// an English preposition, "or" is Oregon and also a conjunction.
var usStates = []string{
	"al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id",
	"il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms",
	"mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok",
	"or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv",
	"wi", "wy", "dc",
}

var caProvinces = []string{
	"ab", "bc", "mb", "nb", "nl", "ns", "nt", "nu", "on", "pe", "qc", "sk", "yt",
}

var usNames = []string{
	"united states", "usa", "u.s.", "america", "remote - us", "remote, us",
}

// Country names are checked before anything else; city names last, because a
// city name is the weakest signal — "Vancouver, WA" is a real US city.
var caNames = []string{"canada"}

var caCities = []string{
	"toronto", "montreal", "ottawa", "calgary", "edmonton", "waterloo",
	"mississauga", "quebec city",
}

// Enough to catch common non-North-American postings. Not exhaustive on
// purpose: anything missing falls through to Unknown and is kept, which is the
// safe direction to be wrong in.
var otherNames = []string{
	"united kingdom", "england", "scotland", "ireland", "london",
	"germany", "berlin", "munich", "france", "paris", "netherlands",
	"amsterdam", "spain", "madrid", "barcelona", "italy", "poland", "warsaw",
	"sweden", "switzerland", "zurich", "israel", "tel aviv",
	"india", "bangalore", "bengaluru", "hyderabad", "pune", "mumbai", "delhi",
	"singapore", "japan", "tokyo", "china", "beijing", "shanghai",
	"australia", "sydney", "melbourne", "new zealand", "brazil", "mexico city",
	"south africa", "korea", "seoul", "taiwan", "philippines", "vietnam",
}

// Region guesses which country a location string refers to.
//
// Signals are checked strongest first: an explicit country name, then a
// state or province code, then a city name, then a foreign country. City
// names come late because they're ambiguous — "Vancouver, WA" is in
// Washington, and its state code has to win.
func Region(raw string) string {
	text := strings.ToLower(strings.TrimSpace(raw))
	if text == "" {
		return Unknown
	}

	for _, name := range caNames {
		if hasName(text, name) {
			return Canada
		}
	}

	for _, name := range usNames {
		if hasName(text, name) {
			return US
		}
	}

	for _, code := range caProvinces {
		if hasCode(text, code) {
			return Canada
		}
	}

	for _, code := range usStates {
		if hasCode(text, code) {
			return US
		}
	}

	for _, name := range caCities {
		if hasName(text, name) {
			return Canada
		}
	}

	for _, name := range otherNames {
		if hasName(text, name) {
			return Other
		}
	}

	return Unknown
}

// Whole-token match for single-word names: "india" must not match inside
// "Indianapolis". Multi-word names ("united kingdom") can't collide this way,
// so a substring check is fine for those.
func hasName(text, name string) bool {
	if strings.Contains(name, " ") {
		return strings.Contains(text, name)
	}

	return hasCode(text, name)
}

// A code or single word only counts when it stands alone — "in" inside
// "Indianapolis" is not Indiana.
func hasCode(text, code string) bool {
	fields := strings.FieldsFunc(text, func(r rune) bool {
		return r == ',' || r == ' ' || r == '/' || r == '(' || r == ')' || r == '-'
	})

	for _, field := range fields {
		if field == code {
			return true
		}
	}

	return false
}

// Matches reports whether a location passes the user's chosen regions.
//
// No regions chosen means no filter. An unrecognised location also passes:
// dropping every posting we can't parse would silently lose real matches, and
// bare "Remote" appears constantly. Fails open, deliberately.
func Matches(raw string, regions []string) bool {
	if len(regions) == 0 {
		return true
	}

	region := Region(raw)
	if region == Unknown {
		return true
	}

	for _, wanted := range regions {
		if wanted == region {
			return true
		}
	}

	return false
}

// Display tidies a location for the panel: collapsed whitespace, no trailing
// separators, and empty rendered as a dash rather than a blank gap.
func Display(raw string) string {
	text := strings.Join(strings.Fields(raw), " ")
	text = strings.Trim(text, " ,-")

	if text == "" {
		return "—"
	}

	return text
}
