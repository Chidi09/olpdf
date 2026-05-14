package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// startAsyncToolkitJob creates a job, launches a goroutine, and returns the job ID.
func startAsyncToolkitJob(w http.ResponseWriter, r *http.Request, operation string, body []byte) {
	var req struct {
		DocID string `json:"doc_id"`
	}
	if err := json.Unmarshal(body, &req); err != nil || req.DocID == "" {
		http.Error(w, `{"error":"doc_id_required"}`, http.StatusBadRequest)
		return
	}

	// Create job via API
	apiBase := os.Getenv("API_BASE_URL")
	workerSecret := os.Getenv("WORKER_SECRET")
	if apiBase == "" || workerSecret == "" {
		http.Error(w, `{"error":"api_not_configured"}`, http.StatusInternalServerError)
		return
	}

	jobPayload, _ := json.Marshal(map[string]string{
		"document_id": req.DocID,
		"operation":   operation,
	})

	jobResp, err := http.Post(apiBase+"/api/pdf-jobs", "application/json", bytes.NewReader(jobPayload))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"job_creation_failed","detail":"%s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer jobResp.Body.Close()

	var jobResult struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(jobResp.Body).Decode(&jobResult); err != nil || jobResult.ID == "" {
		http.Error(w, `{"error":"invalid_job_response"}`, http.StatusBadGateway)
		return
	}

	jobID := jobResult.ID

	// Launch async worker
	go func() {
		updateJobStatus(jobID, "running", 10, "Starting operation")
		result := runToolkitOperation(operation, body, apiBase, workerSecret)
		if result.err != nil {
			updateJobError(jobID, result.err.Error())
			return
		}
		updateJobSuccess(jobID, 100, "Operation complete", result.outputs)
	}()

	// Return 202 immediately
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]any{
		"job_id":  jobID,
		"status":  "queued",
		"message": "Operation queued in Go processor",
	})
}

type toolkitResult struct {
	outputs []JobOutput
	err     error
}

func runToolkitOperation(operation string, body []byte, apiBase, workerSecret string) toolkitResult {
	// Step 1: Download source PDF from R2
	var req struct {
		DocID     string `json:"doc_id"`
		AuthToken string `json:"_auth_token"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return toolkitResult{err: fmt.Errorf("invalid request: %w", err)}
	}

	updateJobStatus("", "running", 20, "Downloading source PDF")

	objectKey := documentObjectKey(req.DocID)
	pdfData, err := r2DownloadBytes(objectKey)
	if err != nil {
		return toolkitResult{err: fmt.Errorf("download failed: %w", err)}
	}
	_ = pdfData // Used for metadata; actual processing done by Python API

	// Step 2: Call Python API to do the actual operation
	updateJobStatus("", "running", 40, "Processing PDF")

	// Build request with auth forwarding
	path := fmt.Sprintf("/api/pdf/%s?doc_id=%s", operation, req.DocID)
	pyReq, err := http.NewRequest("POST", apiBase+path, bytes.NewReader(body))
	if err != nil {
		return toolkitResult{err: fmt.Errorf("create request failed: %w", err)}
	}
	pyReq.Header.Set("Content-Type", "application/json")
	if req.AuthToken != "" {
		pyReq.Header.Set("Authorization", "Bearer "+req.AuthToken)
	} else if workerSecret != "" {
		pyReq.Header.Set("X-Worker-Secret", workerSecret)
	}

	pyResp, err := http.DefaultClient.Do(pyReq)
	if err != nil {
		return toolkitResult{err: fmt.Errorf("python api call failed: %w", err)}
	}
	defer pyResp.Body.Close()

	pyBody, err := io.ReadAll(pyResp.Body)
	if err != nil {
		return toolkitResult{err: fmt.Errorf("read response failed: %w", err)}
	}

	if pyResp.StatusCode >= 300 {
		return toolkitResult{err: fmt.Errorf("python api returned %s: %s", pyResp.Status, string(pyBody))}
	}

	// Step 3: Parse the response to get the result data
	var pyResult struct {
		URL  string   `json:"url"`
		URLs []string `json:"urls"`
	}
	if err := json.Unmarshal(pyBody, &pyResult); err != nil {
		return toolkitResult{err: fmt.Errorf("parse response failed: %w", err)}
	}

	// Step 4: Register branded download links for each output
	updateJobStatus("", "running", 80, "Creating download links")

	var outputs []JobOutput
	if pyResult.URL != "" {
		outputs = append(outputs, JobOutput{
			URL:      pyResult.URL,
			Filename: fmt.Sprintf("%s_%s.pdf", req.DocID, operation),
		})
	}
	for i, u := range pyResult.URLs {
		outputs = append(outputs, JobOutput{
			URL:      u,
			Filename: fmt.Sprintf("%s_%s_part%d.pdf", req.DocID, operation, i+1),
		})
	}

	return toolkitResult{outputs: outputs}
}

func updateJobStatus(jobID, status string, progress int, message string) {
	payload := map[string]any{
		"status":   status,
		"progress": progress,
		"message":  message,
	}
	data, _ := json.Marshal(payload)

	apiBase := os.Getenv("API_BASE_URL")
	workerSecret := os.Getenv("WORKER_SECRET")
	if apiBase == "" || workerSecret == "" || jobID == "" {
		return
	}

	req, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/api/pdf-jobs/%s", apiBase, jobID), bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Worker-Secret", workerSecret)

	// Don't block on status update failures
	go func() {
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}()
	// Give the goroutine a moment to send the status update
	time.Sleep(10 * time.Millisecond)
}

func updateJobError(jobID, errMsg string) {
	updateJobStatus(jobID, "failed", 0, errMsg)
}

func updateJobSuccess(jobID string, progress int, message string, outputs []JobOutput) {
	payload := map[string]any{
		"status":   "succeeded",
		"progress": progress,
		"message":  message,
		"outputs":  outputs,
	}
	data, _ := json.Marshal(payload)

	apiBase := os.Getenv("API_BASE_URL")
	workerSecret := os.Getenv("WORKER_SECRET")
	if apiBase == "" || workerSecret == "" {
		return
	}

	req, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/api/pdf-jobs/%s", apiBase, jobID), bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Worker-Secret", workerSecret)

	resp, err := http.DefaultClient.Do(req)
	if err == nil {
		resp.Body.Close()
	}
}
