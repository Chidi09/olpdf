package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func handleLayoutExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var req ExportRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if req.LayoutPayload == nil {
		http.Error(w, "layout_payload required", http.StatusBadRequest)
		return
	}

	pw := 595.28
	ph := 841.89
	if len(req.LayoutPayload.Pages) > 0 {
		p := req.LayoutPayload.Pages[0]
		if p.Width > 0 {
			pw = p.Width
		}
		if p.Height > 0 {
			ph = p.Height
		}
	}

	pdf, err := newPDFWriter(pw, ph)
	if err != nil {
		http.Error(w, fmt.Sprintf("PDF init failed: %v", err), http.StatusInternalServerError)
		return
	}

	if r.URL.Query().Get("tagged") == "true" {
		pdf.setTagged(true)
	}

	for i, page := range req.LayoutPayload.Pages {
		if i > 0 {
			pw2 := page.Width
			ph2 := page.Height
			if pw2 <= 0 {
				pw2 = 595.28
			}
			if ph2 <= 0 {
				ph2 = 841.89
			}
			pdf.addPage(pw2, ph2)
		}

		if err := pdf.renderLayoutObjects(page); err != nil {
			http.Error(w, fmt.Sprintf("Render error: %v", err), http.StatusInternalServerError)
			return
		}
	}

	pdfBytes, err := pdf.output()
	if err != nil {
		http.Error(w, fmt.Sprintf("PDF generation failed: %v", err), http.StatusInternalServerError)
		return
	}

	async := r.URL.Query().Get("async")
	if async == "true" {
		jobID := r.URL.Query().Get("job_id")
		if jobID == "" {
			http.Error(w, "job_id required for async", http.StatusBadRequest)
			return
		}
		objectKey := fmt.Sprintf("exports/layout-%s.pdf", jobID)
		if err := r2UploadBytes(objectKey, pdfBytes, "application/pdf"); err != nil {
			updateJob(jobID, JobUpdate{Status: "failed", Message: fmt.Sprintf("Upload failed: %v", err)})
			http.Error(w, "Upload failed", http.StatusInternalServerError)
			return
		}
		dlURL, err := registerDownloadLink(objectKey, fmt.Sprintf("layout-%s.pdf", jobID), "application/pdf", "")
		if err != nil {
			updateJob(jobID, JobUpdate{Status: "failed", Message: fmt.Sprintf("Download link failed: %v", err)})
			http.Error(w, "Download link failed", http.StatusInternalServerError)
			return
		}
		updateJob(jobID, JobUpdate{
			Status:   "completed",
			Progress: 100,
			Outputs:  []JobOutput{{URL: dlURL, Filename: fmt.Sprintf("layout-%s.pdf", jobID), SizeBytes: len(pdfBytes)}},
		})
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"url": dlURL, "status": "completed"})
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	w.Write(pdfBytes)
}
