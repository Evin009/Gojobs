package main

import (
	"fmt"
	"log"
	"net/http"

)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "ok")
}
func healthHandler2(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "pong")
}

func main() {
	dbPool = connectDB()
	fmt.Println("Connection success")

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/ping", healthHandler2)

	
	log.Println("server starting on :8080")


	log.Fatal(http.ListenAndServe(":8080", nil))


}
