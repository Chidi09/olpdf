package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Validate worker secret
	workerSecret := os.Getenv("WORKER_SECRET")
	if workerSecret != "" && r.Header.Get("X-Worker-Secret") != workerSecret {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse multipart form — max 500MB
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"invalid_form","detail":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	docID := r.FormValue("document_id")
	if docID == "" {
		http.Error(w, `{"error":"document_id_required"}`, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"file_required","detail":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}
	defer file.Close()

	pdfData, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"file_read_failed","detail":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// Store the PDF
	objectKey := documentObjectKey(docID)
	if err := r2UploadBytes(objectKey, pdfData, "application/pdf"); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"storage_failed","detail":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// Create job
	apiBase := os.Getenv("API_BASE_URL")
	if apiBase != "" {
		jobPayload, _ := json.Marshal(map[string]string{
			"document_id": docID,
			"operation":   "import",
		})
		resp, err := http.Post(apiBase+"/api/pdf-jobs", "application/json", bytes.NewReader(jobPayload))
		if err == nil {
			defer resp.Body.Close()
			var jobResult struct {
				ID string `json:"id"`
			}
			if json.NewDecoder(resp.Body).Decode(&jobResult) == nil {
				_ = jobResult
			}
		}
	}

	// Register branded download link
	ownerID := r.FormValue("owner_id")
	downloadURL := ""
	if ownerID != "" && apiBase != "" {
		dlPayload, _ := json.Marshal(map[string]string{
			"object_key":   objectKey,
			"filename":     docID + ".pdf",
			"content_type": "application/pdf",
			"owner_id":     ownerID,
		})
		dlReq, _ := http.NewRequest("POST", apiBase+"/api/downloads", bytes.NewReader(dlPayload))
		dlReq.Header.Set("Content-Type", "application/json")
		dlReq.Header.Set("X-Worker-Secret", workerSecret)
		if dlResp, err := http.DefaultClient.Do(dlReq); err == nil {
			defer dlResp.Body.Close()
			var dlResult struct {
				URL string `json:"url"`
			}
			if json.NewDecoder(dlResp.Body).Decode(&dlResult) == nil {
				downloadURL = dlResult.URL
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"document_id":  docID,
		"status":       "queued",
		"download_url": downloadURL,
	})
}
