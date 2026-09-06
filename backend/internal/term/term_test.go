package term

import "testing"

func TestDetect(t *testing.T) {
	cases := []struct {
		title string
		body  string
		want  string
	}{
		{"Software Engineer Intern - Summer 2027", "", "summer_2027"},
		{"2027 Summer Analyst", "", "summer_2027"},
		{"Data Co-op (Fall 2026)", "", "fall_2026"},
		{"Software Engineer", "", NotStated},
		// title wins: the description mentions another term in passing
		{"Intern - Summer 2027", "Previous Fall 2026 interns welcome", "summer_2027"},
		// falls back to the description only when the title says nothing
		{"Engineering Intern", "This is a Spring 2027 placement", "spring_2027"},
		// winter and spring are the same intake, not two
		{"Analyst Intern - Winter 2027", "", "spring_2027"},
		// outside the three we track
		{"Intern - Summer 2029", "", NotStated},
	}

	for _, tc := range cases {
		if got := Detect(tc.title, tc.body); got != tc.want {
			t.Errorf("Detect(%q, %q) = %q, want %q", tc.title, tc.body, got, tc.want)
		}
	}
}

func TestLabel(t *testing.T) {
	if got := Label("summer_2027"); got != "Summer 2027" {
		t.Errorf("Label = %q", got)
	}
}
