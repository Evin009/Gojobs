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
	http.HandleFunc("/repos", addRepoHandler)

	go monitor.StartLoop([]string{"databricks", "robinhood", "cloudflare"}, []string{"intern", "internship"}, 30*time.Minute)

	log.Println("server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
