// OLPDF Export Service — fast PDF generation in Go.
// Replaces Python/ReportLab for standard, PDF/A, Tagged, and fidelity exports.
// Runs on the same Hetzner box as the OCR worker (port 8002).
package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
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

type RichSpan struct {
	Text          string `json:"text"`
	Bold          bool   `json:"bold"`
	Italic        bool   `json:"italic"`
	Underline     bool   `json:"underline"`
	Strikethrough bool   `json:"strikethrough"`
	Color         string `json:"color,omitempty"`
	FontFamily    string `json:"font_family,omitempty"`
	FontSize      float64 `json:"font_size,omitempty"`
}

type Block struct {
	ID          string      `json:"id"`
	Type        string      `json:"type"`
	Content     string      `json:"content"`
	RichSpans   []RichSpan  `json:"rich_spans"`
	PageIndex   int         `json:"page_index"`
	ColumnIndex int         `json:"column_index"`
	BoundingBox []float64   `json:"bounding_box"`
	FontMeta    *FontMeta   `json:"font_meta"`
	Spacing     *Spacing    `json:"spacing"`
	Alignment   string      `json:"alignment"`
	ZIndex      int         `json:"z_index"`
	TableData   *TableData  `json:"table_data"`
	AltText     string      `json:"alt_text,omitempty"`
}

type TableData struct {
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
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

type LayoutObject struct {
	ID         string  `json:"id"`
	Type       string  `json:"type"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Width      float64 `json:"width"`
	Height     float64 `json:"height"`
	Rotation   float64 `json:"rotation"`
	Content    string  `json:"content,omitempty"`
	Src        string  `json:"src,omitempty"`
	FontFamily string  `json:"fontFamily,omitempty"`
	FontSize   float64 `json:"fontSize,omitempty"`
	Fill       string  `json:"fill,omitempty"`
	Stroke     string  `json:"stroke,omitempty"`
}

type LayoutPage struct {
	Index   int            `json:"index"`
	Width   float64        `json:"width"`
	Height  float64        `json:"height"`
	Objects []LayoutObject `json:"objects"`
}

type LayoutPayload struct {
	SourceKind       string       `json:"source_kind"`
	OriginalPdfKey   string       `json:"original_pdf_key,omitempty"`
	Pages            []LayoutPage `json:"pages"`
	ExportStrategy   string       `json:"export_strategy"`
}

type ExportRequest struct {
	DocumentModel     DocumentModel              `json:"document_model"`
	ColorSpace        string                     `json:"color_space"`
	FontMetrics       map[string]map[string]float64 `json:"font_metrics,omitempty"`
	Operations        []EditOperation            `json:"operations,omitempty"`
	OriginalObjectKey string                     `json:"original_object_key,omitempty"`
	LayoutPayload     *LayoutPayload             `json:"layout_payload,omitempty"`
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

func pageSize(dims map[int]PageDimension, idx int) (float64, float64) {
	if d, ok := dims[idx]; ok && d.Width > 0 {
		return d.Width, d.Height
	}
	return 595.28, 841.89 // A4 default
}

// ── Font metrics helpers ──────────────────────────────────────────────────────

func cssFontKey(family string, isBold, isItalic bool, size float64) string {
	style := "normal"
	if isItalic {
		style = "italic"
	}
	weight := "normal"
	if isBold {
		weight = "bold"
	}
	return fmt.Sprintf(`%s %s %gpx "%s"`, style, weight, size, family)
}

func measureWithMetrics(text string, key string, metrics map[string]map[string]float64) float64 {
	if len(metrics) == 0 {
		return -1
	}
	charTable, ok := metrics[key]
	if !ok {
		return -1
	}
	total := 0.0
	for _, ch := range text {
		w, ok := charTable[string(ch)]
		if !ok {
			return -1
		}
		total += w
	}
	return total * 0.75
}

// ── Rich span tokeniser ───────────────────────────────────────────────────────

func tokenizeText(s string) []string {
	var tokens []string
	if len(s) == 0 {
		return tokens
	}
	inSpace := s[0] == ' ' || s[0] == '\t' || s[0] == '\n'
	start := 0
	for i := 0; i < len(s); i++ {
		isS := s[i] == ' ' || s[i] == '\t' || s[i] == '\n'
		if isS != inSpace {
			tokens = append(tokens, s[start:i])
			start = i
			inSpace = isS
		}
	}
	tokens = append(tokens, s[start:])
	return tokens
}

// ── Fidelity export (coordinate-based — preserves exact bounding boxes) ───────

func exportFidelity(model DocumentModel, metrics map[string]map[string]float64) ([]byte, error) {
	dims := map[int]PageDimension{}
	for _, d := range model.PageDimensions {
		dims[d.PageIndex] = d
	}

	byPage := map[int][]Block{}
	for _, b := range model.Blocks {
		if b.Type != "table" && b.Type != "shape" && strings.TrimSpace(b.Content) == "" {
			continue
		}
		byPage[b.PageIndex] = append(byPage[b.PageIndex], b)
	}

	pages := sortedKeys(byPage)
	if len(pages) == 0 {
		pages = []int{0}
	}

	pw, ph := pageSize(dims, pages[0])
	pdf, err := newPDFWriter(pw, ph)
	if err != nil {
		return nil, fmt.Errorf("create pdf: %w", err)
	}
	pdf.setTitle(model.Meta.Title)
	pdf.setAuthor(model.Meta.Author)
	pdf.setCreator("OLPDF Export Service")

	for i, pi := range pages {
		if i > 0 {
			pw, ph = pageSize(dims, pi)
			pdf.addPage(pw, ph)
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
			y1 := block.BoundingBox[3]

			if block.Type == "shape" {
				pdf.renderShape(block, x0, y0, x1, y1)
				continue
			}

			if block.Type == "table" {
				tableW := x1 - x0
				tableH := y1 - y0
				if tableW <= 0 {
					tableW = pw - x0 - 36
				}
				if tableH <= 0 {
					tableH = 80
				}
				pdf.renderTable(block.TableData, x0, y0, tableW, tableH)
				continue
			}

			cellW := x1 - x0
			if cellW <= 0 {
				cellW = pw - x0 - 36
			}

			pdf.applyFont(block.FontMeta)
			pdf.applyTextColor(block.FontMeta)

			lh := fontSize(block.FontMeta) * 1.25
			if block.Spacing != nil && block.Spacing.LineHeight > 0 {
				lh = block.Spacing.LineHeight
			}

			if !pdf.renderRichSpans(block.RichSpans, x0, y0, cellW, lh, block.FontMeta, block.Alignment, metrics) {
				pdf.setXY(x0, y0)
				pdf.multiCell(cellW, lh, block.Content, "", blockAlign(block.Alignment), false)
			}
		}
	}

	return pdf.output()
}

// ── Flow export (reading order — used for PDF/A and Tagged PDF) ───────────────

func exportFlow(model DocumentModel, mode string, metrics map[string]map[string]float64) ([]byte, error) {
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

	pw, ph := pageSize(dims, 0)
	pdf, err := newPDFWriter(pw, ph)
	if err != nil {
		return nil, fmt.Errorf("create pdf: %w", err)
	}

	pdf.setTitle(model.Meta.Title)
	pdf.setAuthor(model.Meta.Author)
	pdf.setCreator("OLPDF Export Service")
	pdf.setSubject("OLPDF " + strings.ToUpper(mode) + " Export")
	pdf.setMargins(marginL, marginT, marginR)
	pdf.setAutoPageBreak(true, marginB)

	usableW := pw - marginL - marginR

	sorted := make([]Block, 0, len(model.Blocks))
	for _, b := range model.Blocks {
		if b.Type != "table" && b.Type != "shape" && strings.TrimSpace(b.Content) == "" {
			continue
		}
		sorted = append(sorted, b)
	}
	sort.Slice(sorted, func(i, j int) bool {
		bi, bj := sorted[i], sorted[j]
		if bi.PageIndex != bj.PageIndex {
			return bi.PageIndex < bj.PageIndex
		}
		if bi.ColumnIndex != bj.ColumnIndex {
			return bi.ColumnIndex < bj.ColumnIndex
		}
		yi, yj := 0.0, 0.0
		if len(bi.BoundingBox) >= 2 {
			yi = bi.BoundingBox[1]
		}
		if len(bj.BoundingBox) >= 2 {
			yj = bj.BoundingBox[1]
		}
		return yi < yj
	})

	for _, block := range sorted {
		if block.Type == "shape" && len(block.BoundingBox) >= 4 {
			pdf.renderShape(block, block.BoundingBox[0], block.BoundingBox[1], block.BoundingBox[2], block.BoundingBox[3])
			continue
		}
		if block.Type == "table" && block.TableData != nil {
			numRows := len(block.TableData.Rows)
			if len(block.TableData.Headers) > 0 {
				numRows++
			}
			if numRows == 0 {
				numRows = 1
			}
			tableH := float64(numRows) * 14.0
			x, y := pdf.getXY()
			pdf.renderTable(block.TableData, x, y, usableW, tableH)
			pdf.setY(y + tableH + 8)
			continue
		}

		pdf.applyFont(block.FontMeta)
		pdf.applyTextColor(block.FontMeta)

		lh := fontSize(block.FontMeta) * 1.25
		if block.Spacing != nil && block.Spacing.LineHeight > 0 {
			lh = block.Spacing.LineHeight
		}
		marginAfter := fontSize(block.FontMeta) * 0.5
		if block.Spacing != nil && block.Spacing.MarginBottom > 0 {
			marginAfter = block.Spacing.MarginBottom
		}

		x, y := pdf.getXY()
		if !pdf.renderRichSpans(block.RichSpans, x, y, usableW, lh, block.FontMeta, block.Alignment, metrics) {
			pdf.multiCell(usableW, lh, block.Content, "", blockAlign(block.Alignment), false)
		} else {
			_, curY := pdf.getXY()
			pdf.setY(curY + lh)
		}
		pdf.ln(marginAfter)
	}

	raw, err := pdf.output()
	if err != nil {
		return nil, err
	}

	if mode == "tagged" {
		taggedBuf, err := InjectPDFUA(bytes.NewBuffer(raw))
		if err != nil {
			return nil, fmt.Errorf("tagged pdf: %w", err)
		}
		return taggedBuf.Bytes(), nil
	}

	return raw, nil
}

// ── Image export (per-page JPEG → ZIP) ───────────────────────────────────────

func blockColor(blockType string) color.RGBA {
	switch blockType {
	case "heading":
		return color.RGBA{30, 41, 59, 255}
	case "table":
		return color.RGBA{226, 232, 240, 255}
	case "image":
		return color.RGBA{199, 210, 254, 255}
	case "form_field":
		return color.RGBA{167, 243, 208, 255}
	default:
		return color.RGBA{51, 51, 51, 255}
	}
}

func exportImages(model DocumentModel, dpi int) ([]byte, error) {
	if dpi <= 0 {
		dpi = 96
	}
	scale := float64(dpi) / 72.0

	dims := map[int]PageDimension{}
	for _, d := range model.PageDimensions {
		dims[d.PageIndex] = d
	}

	pageSet := map[int]bool{0: true}
	for _, b := range model.Blocks {
		pageSet[b.PageIndex] = true
	}
	pageIndices := make([]int, 0, len(pageSet))
	for pi := range pageSet {
		pageIndices = append(pageIndices, pi)
	}
	sort.Ints(pageIndices)

	var zipBuf bytes.Buffer
	zw := zip.NewWriter(&zipBuf)

	for _, pi := range pageIndices {
		pw, ph := pageSize(dims, pi)
		imgW := int(pw * scale)
		imgH := int(ph * scale)
		if imgW <= 0 {
			imgW = int(595.28 * scale)
		}
		if imgH <= 0 {
			imgH = int(841.89 * scale)
		}

		img := image.NewRGBA(image.Rect(0, 0, imgW, imgH))
		draw.Draw(img, img.Bounds(), &image.Uniform{color.White}, image.Point{}, draw.Src)

		pageBlocks := make([]Block, 0)
		for _, b := range model.Blocks {
			if b.PageIndex == pi {
				pageBlocks = append(pageBlocks, b)
			}
		}
		sort.Slice(pageBlocks, func(a, b int) bool {
			return pageBlocks[a].ZIndex < pageBlocks[b].ZIndex
		})

		for _, block := range pageBlocks {
			if len(block.BoundingBox) < 4 {
				continue
			}
			x0 := int(block.BoundingBox[0] * scale)
			y0 := int(block.BoundingBox[1] * scale)
			x1 := int(block.BoundingBox[2] * scale)
			y1 := int(block.BoundingBox[3] * scale)
			if x1 <= x0 || y1 <= y0 {
				continue
			}

			fc := blockColor(block.Type)
			blockRect := image.Rect(x0, y0, x1, y1)

			if block.Type == "table" || block.Type == "image" || block.Type == "form_field" {
				draw.Draw(img, blockRect, &image.Uniform{fc}, image.Point{}, draw.Src)
			} else if strings.TrimSpace(block.Content) != "" {
				lineH := int(fontSize(block.FontMeta) * scale * 1.25)
				if lineH < 3 {
					lineH = 3
				}
				barH := max(1, lineH/4)
				barW := int(float64(x1-x0) * 0.85)
				y := y0 + lineH/4
				for y+barH < y1 {
					lineRect := image.Rect(x0, y, x0+barW, y+barH)
					draw.Draw(img, lineRect, &image.Uniform{fc}, image.Point{}, draw.Src)
					y += lineH
				}
			}
		}

		fname := fmt.Sprintf("page_%03d.jpg", pi+1)
		f, err := zw.Create(fname)
		if err != nil {
			return nil, fmt.Errorf("zip create %s: %w", fname, err)
		}
		if err := jpeg.Encode(f, img, &jpeg.Options{Quality: 90}); err != nil {
			return nil, fmt.Errorf("jpeg encode page %d: %w", pi, err)
		}
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("zip close: %w", err)
	}
	return zipBuf.Bytes(), nil
}

func handleImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	if !authorized(r) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	model, _, _, _, err := parseRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	dpi := 96
	if s := r.URL.Query().Get("dpi"); s != "" {
		if v, e := strconv.Atoi(s); e == nil && v > 0 && v <= 600 {
			dpi = v
		}
	}

	zipBytes, err := exportImages(model, dpi)
	if err != nil {
		log.Printf("[export-service] images export error: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="export-images.zip"`)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(zipBytes)))
	w.WriteHeader(http.StatusOK)
	w.Write(zipBytes)
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

func parseRequest(r *http.Request) (DocumentModel, string, map[string]map[string]float64, []EditOperation, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 32<<20)) // 32 MB limit
	if err != nil {
		return DocumentModel{}, "", nil, nil, fmt.Errorf("read body: %w", err)
	}
	var req ExportRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return DocumentModel{}, "", nil, nil, fmt.Errorf("parse JSON: %w", err)
	}
	cs := req.ColorSpace
	if cs == "" {
		cs = "rgb"
	}
	return req.DocumentModel, cs, req.FontMetrics, req.Operations, nil
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

		model, _, metrics, ops, err := parseRequest(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		applyOperations(&model, ops)

		var pdfBytes []byte
		switch mode {
		case "fidelity":
			pdfBytes, err = exportFidelity(model, metrics)
		default:
			pdfBytes, err = exportFlow(model, mode, metrics)
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
	mux.HandleFunc("/export/images",   handleImages)
	mux.HandleFunc("/export/layout",   handleLayoutExport)

	mux.HandleFunc("/toolkit/merge",          handleMerge)
	mux.HandleFunc("/toolkit/split",          handleSplit)
	mux.HandleFunc("/toolkit/compress",       handleCompress)
	mux.HandleFunc("/toolkit/rotate",         handleRotate)
	mux.HandleFunc("/toolkit/watermark",      handleWatermark)
	mux.HandleFunc("/toolkit/redact",         handleRedact)
	mux.HandleFunc("/toolkit/protect",        handleProtect)
	mux.HandleFunc("/toolkit/forms-detect",   handleFormsDetect)
	mux.HandleFunc("/toolkit/forms-fill",     handleFormsFill)
	mux.HandleFunc("/toolkit/extract-images", handleExtractImages)
	mux.HandleFunc("/toolkit/extract-text", handleExtractText)
	mux.HandleFunc("/toolkit/pdf-to-images", handlePdfToImages)
	mux.HandleFunc("/toolkit/pdf-to-docx", handlePdfToDocx)
	mux.HandleFunc("/toolkit/pdf-to-html", handlePdfToHtml)
	mux.HandleFunc("/toolkit/pdf-to-epub", handlePdfToEpub)
	mux.HandleFunc("/toolkit/pdf-to-markdown", handlePdfToMarkdown)
	mux.HandleFunc("/toolkit/pdf-to-excel", handlePdfToExcel)
	mux.HandleFunc("/toolkit/pdf-to-powerpoint", handlePdfToPowerpoint)
	mux.HandleFunc("/toolkit/word-to-pdf", handleWordToPdf)
	mux.HandleFunc("/toolkit/excel-to-pdf", handleExcelToPdf)
	mux.HandleFunc("/toolkit/powerpoint-to-pdf", handlePowerpointToPdf)
	mux.HandleFunc("/toolkit/html-to-pdf", handleHtmlToPdf)
	mux.HandleFunc("/toolkit/markdown-to-pdf", handleMarkdownToPdf)
	mux.HandleFunc("/toolkit/jpg-to-pdf", handleJpgToPdf)
	mux.HandleFunc("/toolkit/png-to-pdf", handlePngToPdf)
	mux.HandleFunc("/toolkit/svg-to-pdf", handleSvgToPdf)
	mux.HandleFunc("/toolkit/remove-annotations", handleRemoveAnnotations)
	mux.HandleFunc("/toolkit/flatten-forms", handleFlattenForms)
	mux.HandleFunc("/toolkit/linearize", handleLinearize)
	mux.HandleFunc("/toolkit/add-page-numbers", handleAddPageNumbers)
	mux.HandleFunc("/toolkit/add-header", handleAddHeader)
	mux.HandleFunc("/toolkit/add-footer", handleAddFooter)
	mux.HandleFunc("/toolkit/remove-metadata", handleRemoveMetadata)
	mux.HandleFunc("/toolkit/set-metadata", handleSetMetadata)
	mux.HandleFunc("/toolkit/repair", handleRepair)
	mux.HandleFunc("/toolkit/grayscale", handleGrayscale)
	mux.HandleFunc("/toolkit/invert-colors", handleInvertColors)
	mux.HandleFunc("/toolkit/add-background", handleAddBackground)
	mux.HandleFunc("/toolkit/add-stamp", handleAddStamp)
	mux.HandleFunc("/toolkit/replace-text", handleReplaceText)
	mux.HandleFunc("/toolkit/replace-images", handleReplaceImages)
	mux.HandleFunc("/toolkit/cleanup", handleCleanup)
	mux.HandleFunc("/toolkit/bates-numbering", handleBatesNumbering)
	mux.HandleFunc("/toolkit/ocr", handleOcr)
	mux.HandleFunc("/toolkit/crop-pages", handleCropPages)
	mux.HandleFunc("/toolkit/extract-pages", handleExtractPages)
	mux.HandleFunc("/toolkit/delete-pages", handleDeletePages)
	mux.HandleFunc("/toolkit/reorder-pages", handleReorderPages)
	mux.HandleFunc("/toolkit/scale-pages", handleScalePages)
	mux.HandleFunc("/toolkit/remove-blank-pages", handleRemoveBlankPages)
	mux.HandleFunc("/toolkit/remove-margins", handleRemoveMargins)
	mux.HandleFunc("/toolkit/add-margins", handleAddMargins)
	mux.HandleFunc("/toolkit/reverse-pages", handleReversePages)
	mux.HandleFunc("/toolkit/resize-pdf", handleResizePdf)
	mux.HandleFunc("/toolkit/deskew", handleDeskew)
	mux.HandleFunc("/toolkit/split-by-size", handleSplitBySize)
	mux.HandleFunc("/toolkit/split-by-bookmarks", handleSplitByBookmarks)
	mux.HandleFunc("/toolkit/booklet-printing", handleBookletPrinting)
	mux.HandleFunc("/toolkit/n-up", handleNUp)
	mux.HandleFunc("/toolkit/set-initial-view", handleSetInitialView)
	mux.HandleFunc("/toolkit/remove-bookmarks", handleRemoveBookmarks)
	mux.HandleFunc("/toolkit/create-bookmarks", handleCreateBookmarks)
	mux.HandleFunc("/toolkit/extract-fonts", handleExtractFonts)
	mux.HandleFunc("/toolkit/embed-fonts", handleEmbedFonts)
	mux.HandleFunc("/toolkit/unembed-fonts", handleUnembedFonts)
	mux.HandleFunc("/toolkit/extract-attachments", handleExtractAttachments)
	mux.HandleFunc("/toolkit/add-attachments", handleAddAttachments)
	mux.HandleFunc("/toolkit/extract-tables", handleExtractTables)
	mux.HandleFunc("/toolkit/extract-links", handleExtractLinks)
	mux.HandleFunc("/toolkit/extract-form-data", handleExtractFormData)
	mux.HandleFunc("/toolkit/remove-javascript", handleRemoveJavascript)
	mux.HandleFunc("/toolkit/remove-passwords", handleRemovePasswords)
	mux.HandleFunc("/toolkit/redact-text", handleRedactText)
	mux.HandleFunc("/toolkit/compare-pdfs", handleComparePdfs)
	mux.HandleFunc("/toolkit/validate-pdfa", handleValidatePdfa)
	mux.HandleFunc("/toolkit/sign-pdf", handleSignPdf)
	mux.HandleFunc("/toolkit/verify-signature", handleVerifySignature)
	mux.HandleFunc("/toolkit/print-to-pdf", handlePrintToPdf)
	mux.HandleFunc("/toolkit/measure-dimensions", handleMeasureDimensions)
	mux.HandleFunc("/toolkit/pdfa-conversion", handlePdfaConversion)

	mux.HandleFunc("/import/upload", handleUpload)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok"}`)
	})

	log.Printf("[export-service] listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
