package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
)

type SlackMessage struct {
	Text string `json:"text"`
}


// convert msg to slack struct then to JSON and then a post to slack
func SendSlackMessage(message string) error {
	payload := SlackMessage{Text: message}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := os.Getenv("SLACK_WEBHOOK_URL")

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}
