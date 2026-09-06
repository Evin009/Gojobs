package jobsource

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Tracker repos only give a title and a link. The link almost always points at
// an ATS with a public API, so the description can be fetched from there
// rather than scraped off a rendered page.
//
// Four providers cover roughly a fifth of tracker postings. The rest are
// bespoke corporate sites — JS-rendered and all different, which is the
// fragile path this deliberately avoids.

type Ref struct {
	Provider string // "ashby", "greenhouse", "lever", "smartrecruiters"
	Company  string // the board slug
	JobID    string
}

var client = &http.Client{Timeout: 20 * time.Second}

// Parse pulls the provider, company and job id out of an application URL.
// Returns ok=false for anything we can't read, which is most of them.
func Parse(raw string) (Ref, bool) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return Ref{}, false
	}

	host := strings.TrimPrefix(strings.ToLower(parsed.Host), "www.")
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")

	switch {
	// jobs.ashbyhq.com/{company}/{uuid}[/application]
	case host == "jobs.ashbyhq.com" && len(parts) >= 2:
		return Ref{"ashby", parts[0], parts[1]}, true

	// job-boards.greenhouse.io/{company}/jobs/{id}
	case (host == "job-boards.greenhouse.io" || host == "boards.greenhouse.io") && len(parts) >= 3:
		return Ref{"greenhouse", parts[0], parts[2]}, true

	// jobs.lever.co/{company}/{uuid}[/apply]
	case host == "jobs.lever.co" && len(parts) >= 2:
		return Ref{"lever", parts[0], parts[1]}, true

	// jobs.smartrecruiters.com/{company}/{id}
	case host == "jobs.smartrecruiters.com" && len(parts) >= 2:
		return Ref{"smartrecruiters", parts[0], parts[1]}, true
	}

	return Ref{}, false
}

// Descriptions fetches every posting for one company and returns them keyed by
// job id.
//
// Whole board at once, not one request per job: Ashby and Lever only offer the
// board endpoint anyway, and for the others it turns dozens of requests into
// one.
func Descriptions(provider, company string) (map[string]string, error) {
	switch provider {
	case "ashby":
		return ashby(company)
	case "lever":
		return lever(company)
	case "greenhouse":
		return greenhouse(company)
	case "smartrecruiters":
		return smartrecruiters(company)
	}

	return nil, nil
}

func get(url string, into any) error {
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// a delisted company or a bad slug answers 404; nothing to read, and not
	// worth failing the whole run over
	if resp.StatusCode != http.StatusOK {
		return nil
	}

	return json.NewDecoder(resp.Body).Decode(into)
}

func ashby(company string) (map[string]string, error) {
	var body struct {
		Jobs []struct {
			ID               string `json:"id"`
			DescriptionPlain string `json:"descriptionPlain"`
		} `json:"jobs"`
	}

	if err := get("https://api.ashbyhq.com/posting-api/job-board/"+company, &body); err != nil {
		return nil, err
	}

	out := map[string]string{}
	for _, job := range body.Jobs {
		out[job.ID] = job.DescriptionPlain
	}

	return out, nil
}

func lever(company string) (map[string]string, error) {
	var body []struct {
		ID              string `json:"id"`
		Description     string `json:"description"`
		DescriptionBody string `json:"descriptionPlain"`
	}

	if err := get("https://api.lever.co/v0/postings/"+company+"?mode=json", &body); err != nil {
		return nil, err
	}

	out := map[string]string{}
	for _, job := range body {
		text := job.DescriptionBody
		if text == "" {
			text = job.Description
		}

		out[job.ID] = text
	}

	return out, nil
}

func greenhouse(company string) (map[string]string, error) {
	var body struct {
		Jobs []struct {
			ID      int64  `json:"id"`
			Content string `json:"content"`
		} `json:"jobs"`
	}

	if err := get("https://boards-api.greenhouse.io/v1/boards/"+company+"/jobs?content=true", &body); err != nil {
		return nil, err
	}

	out := map[string]string{}
	for _, job := range body.Jobs {
		out[strconv.FormatInt(job.ID, 10)] = job.Content
	}

	return out, nil
}

func smartrecruiters(company string) (map[string]string, error) {
	var body struct {
		Content []struct {
			ID string `json:"id"`
		} `json:"content"`
	}

	// The list endpoint carries no descriptions, so this only confirms the
	// company exists. Bodies come one job at a time below.
	if err := get("https://api.smartrecruiters.com/v1/companies/"+company+"/postings", &body); err != nil {
		return nil, err
	}

	out := map[string]string{}
	for _, job := range body.Content {
		var detail struct {
			JobAd struct {
				Sections struct {
					JobDescription struct {
						Text string `json:"text"`
					} `json:"jobDescription"`
					Qualifications struct {
						Text string `json:"text"`
					} `json:"qualifications"`
				} `json:"sections"`
			} `json:"jobAd"`
		}

		if err := get("https://api.smartrecruiters.com/v1/companies/"+company+"/postings/"+job.ID, &detail); err != nil {
			continue
		}

		sections := detail.JobAd.Sections
		out[job.ID] = sections.JobDescription.Text + "\n" + sections.Qualifications.Text
	}

	return out, nil
}
