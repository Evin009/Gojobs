package github

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

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

// FetchListings hits a repo's JSON listings feed. Root is a plain array,
// unlike Greenhouse's wrapped {"jobs": [...]}.
func FetchListings(url string) ([]Listing, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var listings []Listing
	if err := json.NewDecoder(resp.Body).Decode(&listings); err != nil {
		return nil, err
	}

	return listings, nil
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

// Save inserts matched listings, returns the ones that were actually new.
func Save(listings []Listing) []jobposting.Posting {
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
			})
		}
	}

	return newJobs
}
