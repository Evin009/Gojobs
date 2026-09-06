package greenhouse

import (
	"encoding/json"
	"fmt"
	"github.com/Evin009/Gojobs/backend/internal/education"
	"github.com/Evin009/Gojobs/backend/internal/match"
	"github.com/Evin009/Gojobs/backend/internal/sponsorship"
	"github.com/Evin009/Gojobs/backend/internal/term"
	"net/http"

	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/jobposting"
)

type Location struct {
	Name string `json:"name"`
}

type Job struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	AbsoluteURL string   `json:"absolute_url"`
	CompanyName string   `json:"company_name"`
	Location    Location `json:"location"`
	// Full HTML description. Only present with ?content=true, which costs
	// nothing extra — the same one request returns every job with its body.
	Content   string `json:"content"`
	UpdatedAt string `json:"updated_at"`
}

type response struct {
	Jobs []Job `json:"jobs"`
}

// FetchJobs hits Greenhouse's public JSON API for a company's job board.
func FetchJobs(company string) ([]Job, error) {
	// content=true so descriptions arrive with the listing. Without it we'd
	// need one request per job to read education requirements.
	url := "https://boards-api.greenhouse.io/v1/boards/" + company + "/jobs?content=true"

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result response
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Jobs, nil
}

// FilterByRoles keeps jobs whose title matches any chosen discipline AND any
// chosen level. An empty list on either axis means no filter there.
func FilterByRoles(jobs []Job, disciplines, levels []string) []Job {
	var matches []Job

	for _, job := range jobs {
		if match.Title(job.Title, disciplines, levels) {
			matches = append(matches, job)
		}
	}

	return matches
}

// Save inserts matched jobs, returns the ones that were actually new.
func Save(jobs []Job) []jobposting.Posting {
	var newJobs []jobposting.Posting

	for _, job := range jobs {
		degrees := education.Levels(job.Content)
		intake := term.Detect(job.Title, job.Content)
		visa := sponsorship.Classify(job.Content)

		inserted, err := db.InsertJob(job.CompanyName, job.Title, "", job.AbsoluteURL, "greenhouse", job.Location.Name, degrees, intake, visa)
		if err != nil {
			fmt.Println(err)
			continue
		}

		// already known: fill in a location if it's missing, since the insert
		// above skipped the row entirely
		if !inserted {
			if err := db.BackfillLocation(job.AbsoluteURL, job.Location.Name); err != nil {
				fmt.Println("backfill location:", err)
			}

			if err := db.BackfillEducation(job.AbsoluteURL, degrees); err != nil {
				fmt.Println("backfill education:", err)
			}

			if err := db.BackfillTerm(job.AbsoluteURL, intake); err != nil {
				fmt.Println("backfill term:", err)
			}
		}

		if inserted {
			newJobs = append(newJobs, jobposting.Posting{
				CompanyName: job.CompanyName,
				Title:       job.Title,
				AbsoluteURL: job.AbsoluteURL,
				Location:    job.Location.Name,
				Source:      "greenhouse",
			})
		}
	}

	return newJobs
}
