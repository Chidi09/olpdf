package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
)

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
