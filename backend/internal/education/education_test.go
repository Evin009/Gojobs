package education

import "testing"

func TestLevels(t *testing.T) {
	cases := []struct {
		text string
		want string
	}{
		{"Requires a Bachelor's degree in CS", Bachelors},
		{"MS or PhD in Machine Learning", Masters + "," + PhD},
		{"Bachelor's required, Master's preferred", Bachelors + "," + Masters},
		{"<p>We want a <b>PhD</b> in physics</p>", PhD},
		{"Great communication skills", NotStated},
		// "ms" inside "systems" and "ba" inside "database" must not count
		{"Experience with distributed systems and database design", NotStated},

		// the abbreviations postings actually use
		{"B.A. or B.S. in Computer Science", Bachelors},
		{"BS/MS in a technical field", Bachelors + "," + Masters},
		{"Pursuing a B.Tech in Electronics", Bachelors},
		{"Currently enrolled in an undergraduate program", Bachelors},
		{"MBA candidates preferred", Masters},
		{"Baccalaureate degree required", Bachelors},
		{"D.Phil in a quantitative discipline", PhD},

		// Microsoft, not a master's — this appears in a large share of postings
		{"Proficiency with MS Office and MS Excel", NotStated},
		{"Strong MS SQL Server experience", NotStated},

		// "MA" is the state code in a location line, not an arts degree
		{"This role is based in Boston, MA", NotStated},
		{"", NotStated},
	}

	for _, tc := range cases {
		if got := Levels(tc.text); got != tc.want {
			t.Errorf("Levels(%q) = %q, want %q", tc.text, got, tc.want)
		}
	}
}

// A row saved before this column existed must behave like "not stated", not
// like something that matches every filter.
func TestBlankCountsAsNotStated(t *testing.T) {
	if !Matches("", []string{NotStated}) {
		t.Error("blank should match a not-stated filter")
	}

	if Matches("", []string{Bachelors}) {
		t.Error("blank should not match a bachelors filter")
	}
}
