package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/github"
	"github.com/Evin009/Gojobs/backend/internal/location"
	"github.com/Evin009/Gojobs/backend/internal/match"
	"github.com/Evin009/Gojobs/backend/internal/monitor"
	"github.com/Evin009/Gojobs/backend/internal/roles"
)

// withCORS wraps a handler to allow the extension (running on other origins,
// e.g. https://github.com) to call it. Browsers send an OPTIONS "preflight"
// request first to check permission before the real request — we answer
// that directly and never pass it to the wrapped handler.
func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// Chrome's Private Network Access check: a page on a public site calling
		// localhost is blocked unless the server opts in here. Separate from
		// ordinary CORS — the Allow-Origin headers above don't cover it.
		if r.Header.Get("Access-Control-Request-Private-Network") == "true" {
			w.Header().Set("Access-Control-Allow-Private-Network", "true")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// GET /health — liveness check, always returns "ok"
func healthHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "ok")
}

// GET /ping — simple connectivity check, always returns "pong"
func healthHandler2(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "pong")
}

// expected JSON body shape for POST /repos
// The extension sends the repo identity, not a feed URL — where a tracker
// publishes its jobs is backend knowledge, and the client shouldn't guess it.
type addRepoRequest struct {
	Owner string `json:"owner"`
	Repo  string `json:"repo"`
}

// /repos — GET lists monitored repos, POST adds one.
// Method is branched here rather than registered as separate "GET /repos" /
// "POST /repos" patterns, because an OPTIONS preflight would match neither and
// get a 405 before withCORS could answer it.
func reposHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		listReposHandler(w, r)
	case http.MethodPost:
		addRepoHandler(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// GET /repos — returns every monitored feed URL as a JSON array, so the
// extension can tell whether the repo it's on is already being watched.
func listReposHandler(w http.ResponseWriter, r *http.Request) {
	urls, err := db.GetMonitoredRepos()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// a nil slice encodes as JSON `null`, which would break the caller's
	// array handling — send an empty array instead
	if urls == nil {
		urls = []string{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(urls)
}

// GET /repos/check?owner=X&repo=Y — tells the extension two things before it
// renders anything: is this repo monitorable at all, and is it already watched.
//
// Resolution is expensive (several fetches, and markdown feeds mean downloading
// a whole README), so results are cached in repo_checks — including negatives,
// which is what keeps ordinary repos cheap to skip on every page view.
func checkRepoHandler(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	repo := r.URL.Query().Get("repo")

	if owner == "" || repo == "" {
		http.Error(w, "owner and repo are required", http.StatusBadRequest)
		return
	}

	feedURL, cached, err := db.GetRepoCheck(owner, repo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if !cached {
		// first time we've seen this repo — resolve once, then remember the
		// answer either way so we never pay for this lookup again
		resolved, resolveErr := github.ResolveFeedURL(owner, repo)
		if resolveErr != nil {
			resolved = "" // no feed; cached as a negative
		}

		if err := db.SaveRepoCheck(owner, repo, resolved); err != nil {
			log.Println("failed to cache repo check:", err)
		}
		feedURL = resolved
	}

	monitored, err := db.IsRepoMonitored(owner, repo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{
		"monitorable": feedURL != "",
		"monitored":   monitored,
	})
}

// POST /repos — takes {owner, repo} from the extension, finds a feed that
// actually works, and only then saves it. Rejecting here is the whole point:
// storing an unreadable feed would "succeed" and then silently never produce
// a single job.
func addRepoHandler(w http.ResponseWriter, r *http.Request) {
	var req addRepoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Owner == "" || req.Repo == "" {
		http.Error(w, "owner and repo are required", http.StatusBadRequest)
		return
	}

	// reuse the cached resolution when the extension already checked this
	// repo on page load, so a click doesn't repeat the whole lookup
	feedURL, cached, err := db.GetRepoCheck(req.Owner, req.Repo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if !cached {
		feedURL, err = github.ResolveFeedURL(req.Owner, req.Repo)
		if err != nil {
			feedURL = ""
		}
		if saveErr := db.SaveRepoCheck(req.Owner, req.Repo, feedURL); saveErr != nil {
			log.Println("failed to cache repo check:", saveErr)
		}
	}

	if feedURL == "" {
		// 422: the request was well-formed, we just can't monitor this repo
		http.Error(w, "no readable job feed found for this repo", http.StatusUnprocessableEntity)
		return
	}

	if err := db.AddMonitoredRepo(feedURL); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// /profile — GET returns every stored fact, POST saves the onboarding form.
// Method is branched here, not registered separately, so OPTIONS preflight
// still reaches withCORS.
// /settings — GET returns every setting, POST upserts the ones sent.
// Same method-branching reason as /repos: an OPTIONS preflight must still
// reach withCORS.
func settingsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		settings, err := db.GetSettings()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if settings == nil {
			settings = make(map[string]string)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(settings)

	case http.MethodPost:
		var values map[string]string
		if err := json.NewDecoder(r.Body).Decode(&values); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if len(values) == 0 {
			http.Error(w, "no settings to save", http.StatusBadRequest)
			return
		}

		if err := db.SaveSettings(values); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// GET /jobs — today's matching postings, plus the counts the panel shows.
//
// Saved jobs are re-filtered against the user's current role settings rather
// than served as-is: narrowing a filter should change what's listed and what's
// counted, without waiting for the next monitoring run.
//
// "Today" is midnight in the reset zone, not a rolling 24 hours — the count is
// meant to go back to zero at a predictable time.
func jobsHandler(w http.ResponseWriter, r *http.Request) {
	since, rangeID := parseRange(r.URL.Query().Get("range"))

	// Searched here rather than in the panel: the panel only receives the
	// capped list, so a browser-side search would silently miss every match
	// past row 200.
	query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	disciplines, levels, err := db.GetRoleKeywords()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	regions, err := db.GetRegions()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	found, err := db.ListJobsSince(since)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// One monitoring interval. Anything newer than this arrived on the last
	// run, which is what "new" means to someone watching the panel.
	recentSince := time.Now().Add(-30 * time.Minute)

	// The panel renders a screenful at a time; the count still reflects every
	// match, so "showing 200 of 5,759" stays honest.
	const listCap = 200

	jobs := []db.Job{}
	matching := 0
	recent := 0

	for _, job := range found {
		if !match.Title(job.Role, disciplines, levels) {
			continue
		}

		if !location.Matches(job.Location, regions) {
			continue
		}

		if !matchesQuery(job, query) {
			continue
		}

		matching++

		if len(jobs) < listCap {
			job.Location = location.Display(job.Location)
			jobs = append(jobs, job)
		}

		// counted inside the filter loop, so it tracks the chosen field, type
		// and location like every other number on the panel
		if job.CreatedAt.After(recentSince) {
			recent++
		}
	}

	counts := facetCounts(found)

	checked, err := db.LastChecked()
	if err != nil {
		// a missing or unparseable timestamp shouldn't fail the whole request;
		// the panel just won't show a "last checked" line
		log.Println("read last_checked:", err)
	}

	lastChecked := ""
	if !checked.IsZero() {
		lastChecked = checked.UTC().Format(time.RFC3339)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"jobs": jobs,
		// matching is every job that passed the filters; jobs is the capped
		// slice actually sent
		"matching": matching,
		"shown":    len(jobs),
		"recent":   recent,
		"range":    rangeID,
		// applications aren't tracked yet (Phase 16). Sent as 0 rather than
		// omitted, so the panel shows an honest zero instead of a blank.
		"applied":      0,
		"last_checked": lastChecked,
		"counts":       counts,
	})
}

// matchesQuery checks the free-text search against the fields a person would
// actually search by. Substring rather than whole-word here — searching is
// exploratory, and "eng" should find "Engineering".
func matchesQuery(job db.Job, query string) bool {
	if query == "" {
		return true
	}

	haystack := strings.ToLower(job.Company + " " + job.Role + " " + job.Location)

	// every term must appear, so "stripe intern" narrows rather than widens
	for _, term := range strings.Fields(query) {
		if !strings.Contains(haystack, term) {
			return false
		}
	}

	return true
}

// How far back the panel is looking. "today" is the default because the panel
// is mainly a "what's new" feed; the wider ranges are for browsing what's
// already been collected.
//
// An unrecognised value falls back to today rather than erroring — a bad query
// string shouldn't empty the panel.
func parseRange(id string) (time.Time, string) {
	switch id {
	case "week":
		return time.Now().AddDate(0, 0, -7), "week"
	case "all":
		return time.Time{}, "all"
	default:
		return db.StartOfDay(), "today"
	}
}

// facetCounts says how many of today's postings match each filter option on
// its own.
//
// Deliberately independent of the other axes: a number that shifts every time
// a different filter changes can't be compared to anything. "US: 40" means
// forty US postings today, always — not forty given whatever else is ticked.
func facetCounts(found []db.Job) map[string]map[string]int {
	counts := map[string]map[string]int{
		"roles":   {},
		"levels":  {},
		"regions": {},
	}

	for _, job := range found {
		for _, role := range roles.Disciplines {
			if match.Any(job.Role, role.Keywords) {
				counts["roles"][role.ID]++
			}
		}

		for _, level := range roles.Levels {
			if match.Any(job.Role, level.Keywords) {
				counts["levels"][level.ID]++
			}
		}

		// Region is exact here rather than going through Matches, which lets
		// unknown locations pass any filter — counting those under both US and
		// Canada would make the numbers meaningless.
		switch location.Region(job.Location) {
		case location.US:
			counts["regions"][location.US]++
		case location.Canada:
			counts["regions"][location.Canada]++
		}
	}

	return counts
}

func profileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		saveProfileHandler(w, r)
		return
	}

	getProfileHandler(w, r)
}

// POST /profile — takes {key: value} and upserts the lot in one batch.
func saveProfileHandler(w http.ResponseWriter, r *http.Request) {
	var facts map[string]string

	if err := json.NewDecoder(r.Body).Decode(&facts); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if len(facts) == 0 {
		http.Error(w, "no facts to save", http.StatusBadRequest)
		return
	}

	if err := db.SaveProfile(facts); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// /resume/base — GET serves the stored .tex, POST replaces it with a new one.
func baseResumeHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		content, err := db.GetBaseResume()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		// content is "" when nothing is uploaded yet — a normal state the
		// caller checks, not an error
		json.NewEncoder(w).Encode(map[string]string{"content": content})

	case http.MethodPost:
		var req struct {
			Content string `json:"content"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if req.Content == "" {
			http.Error(w, "content is required", http.StatusBadRequest)
			return
		}

		id, err := db.SaveBaseResume(req.Content)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"id": id})

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func getProfileHandler(w http.ResponseWriter, r *http.Request) {
	profile, err := db.GetProfile()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if profile == nil {
		profile = make(map[string]string)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)

}

// entry point — connects DB, registers routes, starts the background monitor loop and HTTP server
func main() {
	db.Connect()
	fmt.Println("Connection success")

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/ping", healthHandler2)
	http.HandleFunc("/repos", withCORS(reposHandler))
	http.HandleFunc("/repos/check", withCORS(checkRepoHandler))
	http.HandleFunc("/profile", withCORS(profileHandler))
	http.HandleFunc("/settings", withCORS(settingsHandler))
	http.HandleFunc("/jobs", withCORS(jobsHandler))
	http.HandleFunc("/resume/base", withCORS(baseResumeHandler))

	// Companies and role filters come from settings now, read fresh on every
	// run — editing them in the extension takes effect at the next tick.
	go monitor.StartLoop(30 * time.Minute)

	log.Println("server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
