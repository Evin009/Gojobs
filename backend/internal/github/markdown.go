package github

import (
	"html"
	"regexp"
	"strings"
)

// Some trackers publish jobs as markdown tables instead of a JSON feed, e.g.
//   | <a href="..."><strong>NVIDIA</strong></a> | SWE Intern | Shanghai | <a href="APPLY_URL"><img/></a> | 4d |
// This parses those rows into the same Listing type the JSON feed produces, so
// the rest of the pipeline doesn't care which format a repo used.

var (
	strongRe = regexp.MustCompile(`(?s)<strong>(.*?)</strong>`)
	hrefRe   = regexp.MustCompile(`href="([^"]+)"`)
	tagRe    = regexp.MustCompile(`<[^>]*>`)
	sepRe    = regexp.MustCompile(`^[\s:|-]+$`)
)

// strips HTML tags, decodes entities, collapses whitespace
func cleanCell(s string) string {
	s = tagRe.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	return strings.Join(strings.Fields(s), " ")
}

// splits a "| a | b | c |" row into its trimmed cells
func splitRow(line string) []string {
	line = strings.TrimPrefix(line, "|")
	line = strings.TrimSuffix(line, "|")

	cells := strings.Split(line, "|")
	for i := range cells {
		cells[i] = strings.TrimSpace(cells[i])
	}
	return cells
}

// ParseMarkdownListings extracts job rows from a markdown tracker page.
// Rows without an apply link are skipped — those are usually closed roles.
func ParseMarkdownListings(content string) []Listing {
	var listings []Listing

	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "|") {
			continue
		}

		cells := splitRow(line)
		if len(cells) < 4 {
			continue
		}

		// skip the header row and the |---|---| separator beneath it
		if strings.EqualFold(cells[0], "company") || sepRe.MatchString(line) {
			continue
		}

		// the apply URL lives in an <a href> in the Posting column
		hrefMatch := hrefRe.FindStringSubmatch(cells[3])
		if hrefMatch == nil {
			continue
		}
		applyURL := html.UnescapeString(hrefMatch[1])

		// company is usually wrapped in <strong>; fall back to the raw cell
		company := ""
		if m := strongRe.FindStringSubmatch(cells[0]); m != nil {
			company = cleanCell(m[1])
		} else {
			company = cleanCell(cells[0])
		}

		title := cleanCell(cells[1])
		if company == "" || title == "" {
			continue
		}

		location := cleanCell(cells[2])
		var locations []string
		if location != "" {
			locations = []string{location}
		}

		listings = append(listings, Listing{
			Title:       title,
			AbsoluteURL: applyURL,
			CompanyName: company,
			Location:    locations,
			Active:      true, // markdown tables only list open roles
			IsVisible:   true,
		})
	}

	return listings
}
