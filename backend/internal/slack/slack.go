package slack

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type message struct {
	Text string `json:"text"`
}

// A hung webhook shouldn't hold a monitor goroutine open indefinitely.
var client = &http.Client{Timeout: 10 * time.Second}

// SendTo posts to the given webhook. An empty URL means notifications are off
// or unconfigured — not an error, just nothing to do.
//
// The URL is passed in rather than read from the environment: it's a user
// setting now, editable from the extension, so the caller owns it.
func SendTo(webhookURL, text string) error {
	if webhookURL == "" {
		return nil
	}

	payload, err := json.Marshal(message{Text: text})
	if err != nil {
		return err
	}

	resp, err := client.Post(webhookURL, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Slack answers a bad webhook with 4xx and a plain-text reason. Without
	// this the call "succeeds" and the user never learns their URL is wrong.
	if resp.StatusCode >= 300 {
		return fmt.Errorf("slack returned %s", resp.Status)
	}

	return nil
}
