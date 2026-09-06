package sponsorship

import "testing"

func TestClassify(t *testing.T) {
	cases := []struct {
		text string
		want string
	}{
		// the exact wording seen most often in real postings
		{"We are unable to sponsor or take over sponsorship of an employment Visa at this time", No},
		{"This position is not eligible for work authorization sponsorship", No},
		{"Candidates must not require sponsorship now or in the future", No},
		{"Relocation assistance is provided including visa sponsorship where applicable", Yes},
		{"We sponsor H-1B visas for qualified candidates", Yes},

		// a benefits list, not an immigration statement
		{"Perks include Company Sponsored Conferences & Events and free lunch", NotStated},
		{"We host sponsored hackathons every quarter", NotStated},

		{"Strong communication skills required", NotStated},
		{"", NotStated},
	}

	for _, tc := range cases {
		if got := Classify(tc.text); got != tc.want {
			t.Errorf("Classify(%q) = %q, want %q", tc.text, got, tc.want)
		}
	}
}

// A posting that sponsors in general but not for this role is refusing for
// this role — refusals have to win.
func TestRefusalBeatsOffer(t *testing.T) {
	text := "We will sponsor visas for senior roles. We are unable to sponsor for this internship."

	if got := Classify(text); got != No {
		t.Errorf("got %q, want %q", got, No)
	}
}

// Mentioning the subject without settling it is its own verdict, so these can
// go to Claude later rather than being guessed at now.
func TestUnclear(t *testing.T) {
	text := "Visa sponsorship is handled case by case; speak to your recruiter about sponsor eligibility."

	if got := Classify(text); got != Unclear {
		t.Errorf("got %q, want %q", got, Unclear)
	}
}
