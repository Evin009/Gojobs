package location

import "testing"

func TestRegion(t *testing.T) {
	cases := []struct {
		raw  string
		want string
	}{
		{"New York, NY", US},
		{"San Francisco, CA, United States", US},
		{"Toronto, ON, Canada", Canada},
		{"Vancouver, BC", Canada},
		// a real US city that shares a name with a Canadian one — the state
		// code has to win over the city name
		{"Vancouver, WA", US},
		// recognised, and recognisably neither US nor Canada
		{"London, United Kingdom", Other},
		{"Remote", Unknown},
		{"", Unknown},
		// "in" is Indiana and "india" is a country, but neither is inside
		// "Indianapolis"
		{"Indianapolis", Unknown},
		{"Indianapolis, IN", US},
	}

	for _, tc := range cases {
		if got := Region(tc.raw); got != tc.want {
			t.Errorf("Region(%q) = %q, want %q", tc.raw, got, tc.want)
		}
	}
}

// An unparseable location must not be dropped: "Remote" is extremely common,
// and silently losing those would hide real matches.
func TestUnknownPassesFilter(t *testing.T) {
	if !Matches("Remote", []string{US}) {
		t.Error("unknown location should pass a region filter")
	}

	if Matches("London, United Kingdom", []string{US}) {
		t.Error("a location we did recognise as neither should not pass")
	}
}

func TestNoRegionsMeansNoFilter(t *testing.T) {
	if !Matches("London, United Kingdom", nil) {
		t.Error("empty region list should match everything")
	}
}
