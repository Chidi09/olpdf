package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
)

// isAsyncRequest checks if the requester wants a job-based (async) response.
func isAsyncRequest(r *http.Request) bool {
	return r.URL.Query().Get("async") == "true"
}

// handleAsync dispatches an async job when ?async=true, returns false to continue sync.
func handleAsync(operation string, w http.ResponseWriter, r *http.Request) bool {
	if !isAsyncRequest(r) {
		return false
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"read_failed"}`, http.StatusBadRequest)
		return true
	}
	r.Body = io.NopCloser(bytes.NewReader(body))
	startAsyncToolkitJob(w, r, operation, body)
	return true
}

type mergeRequest struct {
	DocIDs []string `json:"doc_ids"`
}

type splitRequest struct {
	DocID      string      `json:"doc_id"`
	PageRanges []pageRange `json:"page_ranges"`
}

type pageRange struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

type rotateRequest struct {
	DocID       string `json:"doc_id"`
	Rotation    int    `json:"rotation"`
	PageIndices []int  `json:"page_indices"`
}

type watermarkRequest struct {
	DocID   string  `json:"doc_id"`
	Text    string  `json:"text"`
	Opacity float64 `json:"opacity"`
}

func handleMerge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if handleAsync("merge", w, r) {
		return
	}

	var req mergeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.DocIDs) < 2 {
		http.Error(w, "at least 2 doc_ids required", http.StatusUnprocessableEntity)
		return
	}

	proxyToolkitCall(w, r, "/api/pdf/merge", map[string]any{"doc_ids": req.DocIDs})
}

func handleSplit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req splitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}

	path := "/api/pdf/split?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"page_ranges": req.PageRanges})
}

func handleCompress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		DocID string `json:"doc_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}

	path := "/api/pdf/compress?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleRotate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req rotateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}

	path := "/api/pdf/rotate?doc_id=" + url.QueryEscape(req.DocID)
	payload := map[string]any{"rotation": req.Rotation, "page_indices": req.PageIndices}
	proxyToolkitCall(w, r, path, payload)
}

func handleWatermark(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req watermarkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}

	if req.Text == "" {
		req.Text = "CONFIDENTIAL"
	}
	if req.Opacity <= 0 {
		req.Opacity = 0.15
	}

	path := "/api/pdf/watermark?doc_id=" + url.QueryEscape(req.DocID)
	payload := map[string]any{"text": req.Text, "opacity": req.Opacity}
	proxyToolkitCall(w, r, path, payload)
}

// ── Redact Handler ─────────────────────────────────────────────────────────

type redactRequest struct {
	DocID string `json:"doc_id"`
	Areas []struct {
		PageNumber int     `json:"page_number"`
		BBox       []float64 `json:"bbox"`
	} `json:"areas"`
}

func handleRedact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req redactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/redact?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"areas": req.Areas})
}

// ── Protect Handler ────────────────────────────────────────────────────────

type protectRequest struct {
	DocID         string `json:"doc_id"`
	UserPassword  string `json:"user_password"`
	OwnerPassword string `json:"owner_password"`
}

func handleProtect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req protectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/protect?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"user_password": req.UserPassword, "owner_password": req.OwnerPassword})
}

// ── Forms Detect Handler ───────────────────────────────────────────────────

func handleFormsDetect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		DocID string `json:"doc_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/forms-detect?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

// ── Forms Fill Handler ─────────────────────────────────────────────────────

type formsFillRequest struct {
	DocID   string            `json:"doc_id"`
	Payload map[string]string `json:"payload"`
}

func handleFormsFill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req formsFillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/forms-fill?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"payload": req.Payload})
}

// ── Extract Images Handler ─────────────────────────────────────────────────

func handleExtractImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		DocID string `json:"doc_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/extract-images?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func proxyToolkitCall(w http.ResponseWriter, r *http.Request, path string, payload any) {
	apiBase := os.Getenv("API_BASE_URL")
	if apiBase == "" {
		apiBase = "http://localhost:8000"
	}

	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			http.Error(w, "failed to encode payload", http.StatusInternalServerError)
			return
		}
		body = bytes.NewReader(encoded)
	}

	req, err := http.NewRequest(http.MethodPost, apiBase+path, body)
	if err != nil {
		http.Error(w, "failed to create upstream request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if auth := r.Header.Get("Authorization"); auth != "" {
		req.Header.Set("Authorization", auth)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}
