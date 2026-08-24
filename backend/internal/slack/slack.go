package slack

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
)

type message struct {
	Text string `json:"text"`
}

// Send posts a message to the Slack webhook configured via SLACK_WEBHOOK_URL.
func Send(text string) error {
	payload := message{Text: text}

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
