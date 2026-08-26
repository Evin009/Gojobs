package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/db"
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
type addRepoRequest struct {
	URL string `json:"url"`
}

// handle JSON request comming from JS func containing thw github url to store in a struct and then save to db
func addRepoHandler(w http.ResponseWriter, r *http.Request) {
		var req addRepoRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := db.AddMonitoredRepo(req.URL); err != nil {
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
	http.HandleFunc("/repos", withCORS(addRepoHandler))

	go monitor.StartLoop([]string{"databricks", "robinhood", "cloudflare"}, []string{"intern", "internship"}, 30*time.Minute)

	log.Println("server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
