package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/github"
	"github.com/Evin009/Gojobs/backend/internal/monitor"
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

		feedURL, err := github.ResolveFeedURL(req.Owner, req.Repo)
		if err != nil {
			// 422: the request was well-formed, we just can't monitor this repo
			http.Error(w, err.Error(), http.StatusUnprocessableEntity)
			return
		}

		if err := db.AddMonitoredRepo(feedURL); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
	}


// entry point — connects DB, registers routes, starts the background monitor loop and HTTP server
func main() {
	db.Connect()
	fmt.Println("Connection success")

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/ping", healthHandler2)
	http.HandleFunc("/repos", withCORS(reposHandler))

	go monitor.StartLoop([]string{"databricks", "robinhood", "cloudflare"}, []string{"intern", "internship"}, 30*time.Minute)

	log.Println("server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
