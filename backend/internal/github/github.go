package github

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/jobposting"
)

type Listing struct {
	Title       string   `json:"title"`
	AbsoluteURL string   `json:"url"`
	CompanyName string   `json:"company_name"`
	Location    []string `json:"locations"`
	Active      bool     `json:"active"`
	IsVisible   bool     `json:"is_visible"`
}

// FetchListings pulls a repo's job feed. Trackers publish in one of two shapes,
// picked here by file extension:
//   .json — a plain array of listings (not wrapped like Greenhouse's {"jobs": [...]})
//   .md   — a markdown table, parsed by ParseMarkdownListings
func FetchListings(url string) ([]Listing, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// a missing feed returns an HTML 404 page, which would otherwise decode
	// into zero listings and look like "this repo just has no jobs today"
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("feed returned HTTP %d: %s", resp.StatusCode, url)
	}

	if strings.HasSuffix(strings.ToLower(url), ".md") {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		return ParseMarkdownListings(string(body)), nil
	}

	var listings []Listing
	if err := json.NewDecoder(resp.Body).Decode(&listings); err != nil {
		return nil, err
	}

	return listings, nil
}

// Trackers don't agree on where they publish jobs, so ResolveFeedURL tries the
// known conventions in order. Ordered most-specific first: a repo with a JSON
// feed should use it rather than falling through to its README.
var feedCandidates = []string{
	"dev/.github/scripts/listings.json",
	"main/.github/scripts/listings.json",
	"main/README.md",
	"master/README.md",
}

// ResolveFeedURL finds a feed for owner/repo that actually fetches AND parses
// into at least one job. Returns an error if none of the conventions work —
// that's what stops unusable repos from being saved and then failing silently.
func ResolveFeedURL(owner, repo string) (string, error) {
	for _, path := range feedCandidates {
		url := fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/%s", owner, repo, path)

		listings, err := FetchListings(url)
		if err != nil {
			continue // wrong branch or path — try the next convention
		}
		if len(listings) == 0 {
			continue // fetched, but nothing job-shaped in it
		}

		return url, nil
	}

	return "", fmt.Errorf("no readable job feed found for %s/%s", owner, repo)
}

// FilterByKeywords keeps active, visible listings whose title whole-word-matches
// ANY of the given keywords.
func FilterByKeywords(listings []Listing, keywords []string) []Listing {
	var matches []Listing

	for _, listing := range listings {
		if !listing.Active || !listing.IsVisible {
			continue
		}
		for _, keyword := range keywords {
			pattern := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(keyword) + `\b`)
			if pattern.MatchString(listing.Title) {
				matches = append(matches, listing)
				break
			}
		}
	}

	return matches
}

// RepoNameFromURL extracts a readable "owner/repo" label from a raw.githubusercontent.com
// feed URL, e.g. "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/..."
// becomes "SimplifyJobs/Summer2026-Internships". Falls back to the raw URL if it
// doesn't match the expected shape.
func RepoNameFromURL(url string) string {
	parts := strings.Split(url, "/")
	// parts: ["https:", "", "raw.githubusercontent.com", "OWNER", "REPO", ...]
	if len(parts) < 5 {
		return url
	}
	return parts[3] + "/" + parts[4]
}

// Save inserts matched listings, returns the ones that were actually new.
// repoName is attached to each posting so notifications can show which repo it came from.
func Save(listings []Listing, repoName string) []jobposting.Posting {
	var newJobs []jobposting.Posting

	for _, listing := range listings {
		location := ""
		if len(listing.Location) > 0 {
			location = listing.Location[0]
		}

		inserted, err := db.InsertJob(listing.CompanyName, listing.Title, "", listing.AbsoluteURL, "github")
		if err != nil {
			fmt.Println(err)
			continue
		}

		if inserted {
			newJobs = append(newJobs, jobposting.Posting{
				CompanyName: listing.CompanyName,
				Title:       listing.Title,
				AbsoluteURL: listing.AbsoluteURL,
				Location:    location,
				Source:      "github",
				RepoName:    repoName,
			})
		}
	}

	return newJobs
}
