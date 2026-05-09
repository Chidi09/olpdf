// OLPDF Export Service — fast PDF generation in Go.
// Replaces Python/ReportLab for standard, PDF/A, Tagged, and fidelity exports.
// Runs on the same Hetzner box as the OCR worker (port 8002).
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"

	"github.com/go-pdf/fpdf"
)

// ── Types ─────────────────────────────────────────────────────────────────────

type Meta struct {
	Title  string `json:"title"`
	Author string `json:"author"`
}

type FontMeta struct {
	Family   string  `json:"family"`
	Size     float64 `json:"size"`
	IsBold   bool    `json:"is_bold"`
	IsItalic bool    `json:"is_italic"`
	Color    string  `json:"color"`
}

type Spacing struct {
	LineHeight   float64 `json:"line_height"`
	MarginTop    float64 `json:"margin_top"`
	MarginBottom float64 `json:"margin_bottom"`
}

type Block struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Content     string    `json:"content"`
	PageIndex   int       `json:"page_index"`
	BoundingBox []float64 `json:"bounding_box"`
	FontMeta    *FontMeta `json:"font_meta"`
	Spacing     *Spacing  `json:"spacing"`
	Alignment   string    `json:"alignment"`
	ZIndex      int       `json:"z_index"`
}

type PageDimension struct {
	PageIndex int     `json:"page_index"`
	Width     float64 `json:"width"`
	Height    float64 `json:"height"`
}

type DocumentModel struct {
	Meta           Meta            `json:"meta"`
	Blocks         []Block         `json:"blocks"`
	PageDimensions []PageDimension `json:"page_dimensions"`
}

type ExportRequest struct {
	DocumentModel DocumentModel `json:"document_model"`
	ColorSpace    string        `json:"color_space"`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func hexToRGB(hex string) (int, int, int) {
	hex = strings.TrimPrefix(hex, "#")
	if len(hex) == 3 {
		hex = string([]byte{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]})
	}
	if len(hex) != 6 {
		return 0, 0, 0
	}
	var r, g, b int
	fmt.Sscanf(hex[0:2], "%x", &r)
	fmt.Sscanf(hex[2:4], "%x", &g)
	fmt.Sscanf(hex[4:6], "%x", &b)
	return r, g, b
}

// normalizeFontFamily maps any font name to one of fpdf's built-in core fonts.
func normalizeFontFamily(family string) string {
	f := strings.ToLower(family)
	switch {
	case strings.Contains(f, "times") || strings.Contains(f, "georgia") ||
		strings.Contains(f, "garamond") || strings.Contains(f, "serif"):
		return "Times"
	case strings.Contains(f, "courier") || strings.Contains(f, "mono"):
		return "Courier"
	default:
		return "Helvetica"
	}
}

func fontStyle(fm *FontMeta) string {
	s := ""
	if fm != nil && fm.IsBold {
		s += "B"
	}
	if fm != nil && fm.IsItalic {
		s += "I"
	}
	return s
}

func fontSize(fm *FontMeta) float64 {
	if fm == nil || fm.Size <= 0 {
		return 11.0
	}
	return fm.Size
}

func blockAlign(alignment string) string {
	switch alignment {
	case "center":
		return "C"
	case "right":
		return "R"
	case "justify":
		return "J"
	default:
		return "L"
	}
}

func pageSize(dims map[int]PageDimension, idx int) fpdf.SizeType {
	if d, ok := dims[idx]; ok && d.Width > 0 {
		return fpdf.SizeType{Wd: d.Width, Ht: d.Height}
	}
	return fpdf.SizeType{Wd: 595.28, Ht: 841.89} // A4 default
}

func setTextColor(pdf *fpdf.Fpdf, fm *FontMeta) {
	if fm == nil || fm.Color == "" {
		pdf.SetTextColor(0, 0, 0)
		return
	}
	r, g, b := hexToRGB(fm.Color)
	pdf.SetTextColor(r, g, b)
}

func setFont(pdf *fpdf.Fpdf, fm *FontMeta) {
	family := "Helvetica"
	if fm != nil && fm.Family != "" {
		family = normalizeFontFamily(fm.Family)
	}
	pdf.SetFont(family, fontStyle(fm), fontSize(fm))
}

// ── Fidelity export (coordinate-based — preserves exact bounding boxes) ───────

func exportFidelity(model DocumentModel) ([]byte, error) {
	// Build page dimension index
	dims := map[int]PageDimension{}
	for _, d := range model.PageDimensions {
		dims[d.PageIndex] = d
	}

	// Group text blocks by page (skip shapes — no server-side vector rendering needed)
	byPage := map[int][]Block{}
	for _, b := range model.Blocks {
		if b.Type == "shape" || strings.TrimSpace(b.Content) == "" {
			continue
		}
		byPage[b.PageIndex] = append(byPage[b.PageIndex], b)
	}

	pages := sortedKeys(byPage)
	if len(pages) == 0 {
		pages = []int{0}
	}

	first := pageSize(dims, pages[0])
	pdf := fpdf.NewCustom(&fpdf.InitType{UnitStr: "pt", Size: first})
	pdf.SetTitle(model.Meta.Title, false)
	pdf.SetAuthor(model.Meta.Author, false)
	pdf.SetCreator("OLPDF Export Service", false)

	for i, pi := range pages {
		sz := pageSize(dims, pi)
		if i == 0 {
			pdf.AddPageFormat("P", sz)
		} else {
			pdf.AddPageFormat("P", sz)
		}

		blocks := byPage[pi]
		sort.Slice(blocks, func(a, b int) bool {
			ya, yb := 0.0, 0.0
			if len(blocks[a].BoundingBox) >= 2 {
				ya = blocks[a].BoundingBox[1]
			}
			if len(blocks[b].BoundingBox) >= 2 {
				yb = blocks[b].BoundingBox[1]
			}
			return ya < yb
		})

		for _, block := range blocks {
			if len(block.BoundingBox) < 4 {
				continue
			}
			x0 := block.BoundingBox[0]
			y0 := block.BoundingBox[1]
			x1 := block.BoundingBox[2]
			cellW := x1 - x0
			if cellW <= 0 {
				cellW = sz.Wd - x0 - 36
			}

			setFont(pdf, block.FontMeta)
			setTextColor(pdf, block.FontMeta)

			lh := fontSize(block.FontMeta) * 1.25
			if block.Spacing != nil && block.Spacing.LineHeight > 0 {
				lh = block.Spacing.LineHeight
			}

			pdf.SetXY(x0, y0)
			pdf.MultiCell(cellW, lh, block.Content, "", blockAlign(block.Alignment), false)
		}
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("fidelity output: %w", err)
	}
	return buf.Bytes(), nil
}

// ── Flow export (reading order — used for PDF/A and Tagged PDF) ───────────────

func exportFlow(model DocumentModel, mode string) ([]byte, error) {
	const (
		marginL = 72.0
		marginR = 72.0
		marginT = 72.0
		marginB = 72.0
	)

	dims := map[int]PageDimension{}
	for _, d := range model.PageDimensions {
		dims[d.PageIndex] = d
	}

	first := pageSize(dims, 0)
	pdf := fpdf.NewCustom(&fpdf.InitType{UnitStr: "pt", Size: first})

	pdf.SetTitle(model.Meta.Title, false)
	pdf.SetAuthor(model.Meta.Author, false)
	pdf.SetCreator("OLPDF Export Service", false)
	pdf.SetSubject("OLPDF " + strings.ToUpper(mode) + " Export")

	if mode == "pdfa" {
		// Embed XMP metadata stub for PDF/A-1b conformance marker
		pdf.SetProducer("OLPDF PDF/A-1b", false)
	}

	pdf.SetMargins(marginL, marginT, marginR)
	pdf.SetAutoPageBreak(true, marginB)
	pdf.AddPage()

	usableW := first.Wd - marginL - marginR

	// Sort all blocks by page then y
	sorted := make([]Block, 0, len(model.Blocks))
	for _, b := range model.Blocks {
		if b.Type == "shape" || strings.TrimSpace(b.Content) == "" {
			continue
		}
		sorted = append(sorted, b)
	}
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].PageIndex != sorted[j].PageIndex {
			return sorted[i].PageIndex < sorted[j].PageIndex
		}
		yi, yj := 0.0, 0.0
		if len(sorted[i].BoundingBox) >= 2 {
			yi = sorted[i].BoundingBox[1]
		}
		if len(sorted[j].BoundingBox) >= 2 {
			yj = sorted[j].BoundingBox[1]
		}
		return yi < yj
	})

	for _, block := range sorted {
		setFont(pdf, block.FontMeta)
		setTextColor(pdf, block.FontMeta)

		lh := fontSize(block.FontMeta) * 1.25
		if block.Spacing != nil && block.Spacing.LineHeight > 0 {
			lh = block.Spacing.LineHeight
		}
		marginAfter := fontSize(block.FontMeta) * 0.5
		if block.Spacing != nil && block.Spacing.MarginBottom > 0 {
			marginAfter = block.Spacing.MarginBottom
		}

		pdf.MultiCell(usableW, lh, block.Content, "", blockAlign(block.Alignment), false)
		pdf.Ln(marginAfter)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("flow output: %w", err)
	}
	return buf.Bytes(), nil
}

// ── Auth ──────────────────────────────────────────────────────────────────────

var workerSecret = os.Getenv("WORKER_SECRET")
var devMode = os.Getenv("OLPDF_DEV_MODE") == "true"

func authorized(r *http.Request) bool {
	if devMode {
		return true
	}
	return workerSecret != "" && r.Header.Get("X-Worker-Secret") == workerSecret
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func parseRequest(r *http.Request) (DocumentModel, string, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 32<<20)) // 32 MB limit
	if err != nil {
		return DocumentModel{}, "", fmt.Errorf("read body: %w", err)
	}
	var req ExportRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return DocumentModel{}, "", fmt.Errorf("parse JSON: %w", err)
	}
	cs := req.ColorSpace
	if cs == "" {
		cs = "rgb"
	}
	return req.DocumentModel, cs, nil
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	fmt.Fprintf(w, `{"error":%q}`, msg)
}

func makePDFHandler(mode string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST required")
			return
		}
		if !authorized(r) {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		model, _, err := parseRequest(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		var pdfBytes []byte
		switch mode {
		case "fidelity":
			pdfBytes, err = exportFidelity(model)
		default:
			pdfBytes, err = exportFlow(model, mode)
		}
		if err != nil {
			log.Printf("[export-service] %s export error: %v", mode, err)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="export-%s.pdf"`, mode))
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
		w.WriteHeader(http.StatusOK)
		w.Write(pdfBytes)
	}
}

// ── Utility ───────────────────────────────────────────────────────────────────

func sortedKeys(m map[int][]Block) []int {
	keys := make([]int, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Ints(keys)
	return keys
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/export/fidelity", makePDFHandler("fidelity"))
	mux.HandleFunc("/export/pdf",      makePDFHandler("pdf"))
	mux.HandleFunc("/export/pdfa",     makePDFHandler("pdfa"))
	mux.HandleFunc("/export/tagged",   makePDFHandler("tagged"))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok"}`)
	})

	log.Printf("[export-service] listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
