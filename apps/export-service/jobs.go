package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type JobUpdate struct {
	Status   string        `json:"status,omitempty"`
	Progress int           `json:"progress,omitempty"`
	Message  string        `json:"message,omitempty"`
	Outputs  []JobOutput   `json:"outputs,omitempty"`
	Error    string        `json:"error,omitempty"`
}

type JobOutput struct {
	URL       string `json:"url"`
	Filename  string `json:"filename"`
	SizeBytes int    `json:"size_bytes"`
}

func jobUpdatePayload(status string, progress int, message string, outputs []JobOutput) map[string]any {
	return map[string]any{
		"status":   status,
		"progress": progress,
		"message":  message,
		"outputs":  outputs,
	}
}

func updateJob(jobID string, update JobUpdate) error {
	apiBase := os.Getenv("API_BASE_URL")
	workerSecret := os.Getenv("WORKER_SECRET")
	if apiBase == "" || workerSecret == "" {
		return fmt.Errorf("API configuration missing")
	}

	body, err := json.Marshal(update)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/pdf-jobs/%s", apiBase, jobID)
	req, err := http.NewRequest("PATCH", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Worker-Secret", workerSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("updateJob %s: %s", jobID, resp.Status)
	}
	return nil
}

func registerDownloadLink(objectKey, filename, contentType, ownerID string) (string, error) {
	apiBase := os.Getenv("API_BASE_URL")
	workerSecret := os.Getenv("WORKER_SECRET")
	if apiBase == "" || workerSecret == "" {
		return "", fmt.Errorf("API not configured")
	}

	payload, _ := json.Marshal(map[string]string{
		"object_key":   objectKey,
		"filename":     filename,
		"content_type": contentType,
		"owner_id":     ownerID,
	})

	req, err := http.NewRequest("POST", apiBase+"/api/downloads", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Worker-Secret", workerSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.URL, nil
}
