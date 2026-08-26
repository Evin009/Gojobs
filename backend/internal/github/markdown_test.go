package github

import "testing"

// a trimmed-down copy of a real tracker table, including the header,
// the |---| separator, and a closed role with no apply link
const sampleTable = `
### FAANG+

| Company | Position | Location | Posting | Age |
|---|---|---|---|---|
| <a href="https://www.nvidia.com"><strong>NVIDIA</strong></a> | Deep Learning SWE Intern - 2027 | Shanghai, China | <a href="https://nvidia.example.com/job/123"><img src="x.png" alt="Apply" width="70"/></a> | 0d |
| <a href="https://www.google.com"><strong>Google</strong></a> | Software Developer Intern - PhD | Waterloo, Canada +2 | <a href="https://google.example.com/job/456"><img src="x.png" alt="Apply" width="70"/></a> | 1d |
| <a href="https://www.closed.com"><strong>ClosedCo</strong></a> | Role That Closed | Nowhere | Closed | 9d |
`

func TestParseMarkdownListings(t *testing.T) {
	listings := ParseMarkdownListings(sampleTable)

	// the header, separator, and the link-less closed row should all be dropped
	if len(listings) != 2 {
		t.Fatalf("expected 2 listings, got %d", len(listings))
	}

	first := listings[0]

	if first.CompanyName != "NVIDIA" {
		t.Errorf("company: expected %q, got %q", "NVIDIA", first.CompanyName)
	}
	if first.Title != "Deep Learning SWE Intern - 2027" {
		t.Errorf("title: expected %q, got %q", "Deep Learning SWE Intern - 2027", first.Title)
	}
	if first.AbsoluteURL != "https://nvidia.example.com/job/123" {
		t.Errorf("url: expected %q, got %q", "https://nvidia.example.com/job/123", first.AbsoluteURL)
	}
	if len(first.Location) != 1 || first.Location[0] != "Shanghai, China" {
		t.Errorf("location: expected [Shanghai, China], got %v", first.Location)
	}
	if !first.Active || !first.IsVisible {
		t.Errorf("expected listing to be active and visible")
	}
}

func TestParseMarkdownListingsIgnoresNonTableText(t *testing.T) {
	listings := ParseMarkdownListings("# Just a heading\n\nSome prose, no tables here.\n")

	if len(listings) != 0 {
		t.Fatalf("expected no listings from prose, got %d", len(listings))
	}
}

// the keyword filter runs on markdown-sourced listings too, so make sure
// they flow through it the same way JSON ones do
func TestParsedListingsWorkWithKeywordFilter(t *testing.T) {
	listings := ParseMarkdownListings(sampleTable)
	matches := FilterByKeywords(listings, []string{"intern"})

	if len(matches) != 2 {
		t.Fatalf("expected both intern roles to match, got %d", len(matches))
	}
}
