package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/go-pdf/fpdf"
)

// renderLayoutObjects renders layout objects onto a new PDF page.
func renderLayoutObjects(pdf *fpdf.Fpdf, page LayoutPage) error {
	for _, obj := range page.Objects {
		if err := renderLayoutObject(pdf, obj); err != nil {
			return fmt.Errorf("render object %s: %w", obj.ID, err)
		}
	}
	return nil
}

func renderLayoutObject(pdf *fpdf.Fpdf, obj LayoutObject) error {
	switch obj.Type {
	case "text":
		family := normalizeFontFamily(obj.FontFamily)
		style := ""
		size := obj.FontSize
		if size <= 0 {
			size = 11
		}
		pdf.SetFont(family, style, size)
		r, g, b := hexToRGB(obj.Fill)
		if obj.Fill == "" {
			r, g, b = 0, 0, 0
		}
		pdf.SetTextColor(r, g, b)
		pdf.SetXY(obj.X, obj.Y)
		cellW := obj.Width
		if cellW <= 0 {
			cellW = 200
		}
		pdf.MultiCell(cellW, size*1.25, pdf.UnicodeTranslatorFromDescriptor("")(obj.Content), "", "", false)

	case "rect", "roundedRect":
		pdf.SetDrawColor(0, 0, 0)
		pdf.SetFillColor(255, 255, 255)
		if obj.Stroke != "" {
			r, g, b := hexToRGB(obj.Stroke)
			pdf.SetDrawColor(r, g, b)
		}
		if obj.Fill != "" && obj.Fill != "transparent" {
			r, g, b := hexToRGB(obj.Fill)
			pdf.SetFillColor(r, g, b)
			pdf.Rect(obj.X, obj.Y, obj.Width, obj.Height, "FD")
		} else {
			pdf.Rect(obj.X, obj.Y, obj.Width, obj.Height, "D")
		}

	case "ellipse":
		pdf.SetDrawColor(0, 0, 0)
		pdf.SetFillColor(255, 255, 255)
		if obj.Stroke != "" {
			r, g, b := hexToRGB(obj.Stroke)
			pdf.SetDrawColor(r, g, b)
		}
		if obj.Fill != "" && obj.Fill != "transparent" {
			r, g, b := hexToRGB(obj.Fill)
			pdf.SetFillColor(r, g, b)
		}
		pdf.Ellipse(obj.X+obj.Width/2, obj.Y+obj.Height/2, obj.Width/2, obj.Height/2, 0, "FD")

	case "line", "arrow":
		pdf.SetDrawColor(0, 0, 0)
		if obj.Stroke != "" {
			r, g, b := hexToRGB(obj.Stroke)
			pdf.SetDrawColor(r, g, b)
		}
		pdf.Line(obj.X, obj.Y, obj.X+obj.Width, obj.Y+obj.Height)
	}
	return nil
}

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

	pdf := fpdf.New("P", "pt", "", "")

	for _, page := range req.LayoutPayload.Pages {
		pw := page.Width
		ph := page.Height
		if pw <= 0 {
			pw = 595.28
		}
		if ph <= 0 {
			ph = 841.89
		}
		pdf.AddPageFormat("", fpdf.SizeType{Wd: pw, Ht: ph})

		if err := renderLayoutObjects(pdf, page); err != nil {
			http.Error(w, fmt.Sprintf("Render error: %v", err), http.StatusInternalServerError)
			return
		}
	}

	outputPath := fmt.Sprintf("/tmp/layout-export-%d.pdf", os.Getpid())
	if err := pdf.OutputFileAndClose(outputPath); err != nil {
		http.Error(w, fmt.Sprintf("PDF generation failed: %v", err), http.StatusInternalServerError)
		return
	}
	defer os.Remove(outputPath)

	pdfBytes, err := os.ReadFile(outputPath)
	if err != nil {
		http.Error(w, "Failed to read output", http.StatusInternalServerError)
		return
	}

	// If async requested, handle via job system
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
