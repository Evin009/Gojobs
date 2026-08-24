package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/Evin009/Gojobs/backend/internal/db"
	"github.com/Evin009/Gojobs/backend/internal/monitor"
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "ok")
}
func healthHandler2(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "pong")
}

func main() {
	db.Connect()
	fmt.Println("Connection success")

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/ping", healthHandler2)

	go monitor.StartLoop([]string{"databricks", "robinhood"}, []string{"intern", "internship"}, 30*time.Minute)

	log.Println("server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
