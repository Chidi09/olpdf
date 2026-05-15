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

// ── Font metrics helpers ──────────────────────────────────────────────────────

// cssFontKey builds the CSS font string used as key in the browser FontMetricsTable.
// Matches the _cssFont() format from apps/web/engine/fontMetrics.ts.
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

// measureWithMetrics returns a word's width in PDF points using the browser-measured
// font metric table, or -1 when the key or any character is missing (caller falls back).
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
	return total * 0.75 // convert browser px (96 dpi) → PDF pts (72 dpi)
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

// renderRichSpans renders inline-formatted text using per-span font settings.
// Falls back to pdf.MultiCell when RichSpans is empty.
// Returns true if spans were rendered, false if the caller should fall back.
func renderRichSpans(pdf *fpdf.Fpdf, spans []RichSpan, x0, y0, cellW, lh float64, defaultFM *FontMeta, align string, metrics map[string]map[string]float64) bool {
	if len(spans) == 0 {
		return false
	}

	curX := x0
	curY := y0
	firstOnLine := true

	for _, span := range spans {
		if span.Text == "" {
			continue
		}

		// Determine per-span font attributes
		style := ""
		isBold := span.Bold || (defaultFM != nil && defaultFM.IsBold)
		isItalic := span.Italic || (defaultFM != nil && defaultFM.IsItalic)
		if isBold {
			style += "B"
		}
		if isItalic {
			style += "I"
		}
		if span.Underline {
			style += "U"
		}

		rawFamily := "Helvetica"
		if span.FontFamily != "" {
			rawFamily = span.FontFamily
		} else if defaultFM != nil && defaultFM.Family != "" {
			rawFamily = defaultFM.Family
		}
		family := normalizeFontFamily(rawFamily)

		sz := fontSize(defaultFM)
		if span.FontSize > 0 {
			sz = span.FontSize
		}

		pdf.SetFont(family, style, sz)

		col := "#111111"
		if span.Color != "" {
			col = span.Color
		} else if defaultFM != nil && defaultFM.Color != "" {
			col = defaultFM.Color
		}
		r, g, b := hexToRGB(col)
		pdf.SetTextColor(r, g, b)

		metricsKey := cssFontKey(rawFamily, isBold, isItalic, sz)
		spaceW := pdf.GetStringWidth(" ")
		if mw := measureWithMetrics(" ", metricsKey, metrics); mw >= 0 {
			spaceW = mw
		}
		tokens := tokenizeText(span.Text)

		for _, tok := range tokens {
			isSpace := strings.TrimSpace(tok) == ""
			if isSpace {
				if !firstOnLine {
					tokSpW := pdf.GetStringWidth(tok)
					if mw := measureWithMetrics(tok, metricsKey, metrics); mw >= 0 {
						tokSpW = mw
					}
					curX += tokSpW
				}
				continue
			}

			tokW := pdf.GetStringWidth(tok)
			if mw := measureWithMetrics(tok, metricsKey, metrics); mw >= 0 {
				tokW = mw
			}
			// Line-wrap: if the word doesn't fit and we're not at the start of the line
			if !firstOnLine && curX+spaceW+tokW > x0+cellW {
				curX = x0
				curY += lh
				firstOnLine = true
			}

			if !firstOnLine {
				curX += spaceW
			}

			pdf.SetXY(curX, curY)
			// Always use pdf.GetStringWidth for the actual cell width (rendering)
			renderW := pdf.GetStringWidth(tok)
			pdf.CellFormat(renderW, lh, tok, "", 0, "L", false, 0, "")
			curX += tokW
			firstOnLine = false
		}
	}
	return true
}

// ── Table renderer ────────────────────────────────────────────────────────────

func renderTable(pdf *fpdf.Fpdf, td *TableData, x0, y0, tableW, tableH float64) {
	if td == nil {
		return
	}
	allRows := [][]string{}
	if len(td.Headers) > 0 {
		allRows = append(allRows, td.Headers)
	}
	allRows = append(allRows, td.Rows...)
	if len(allRows) == 0 {
		return
	}

	numRows := len(allRows)
	numCols := 0
	for _, row := range allRows {
		if len(row) > numCols {
			numCols = len(row)
		}
	}
	if numCols == 0 {
		return
	}

	cellW := tableW / float64(numCols)
	cellH := tableH / float64(numRows)
	if cellH < 10 {
		cellH = 10
	}

	for rowIdx, row := range allRows {
		isHeader := rowIdx == 0 && len(td.Headers) > 0
		for colIdx := 0; colIdx < numCols; colIdx++ {
			cx := x0 + float64(colIdx)*cellW
			cy := y0 + float64(rowIdx)*cellH

			pdf.SetDrawColor(148, 163, 184)
			if isHeader {
				pdf.SetFillColor(226, 232, 240)
			} else {
				pdf.SetFillColor(255, 255, 255)
			}
			pdf.Rect(cx, cy, cellW, cellH, "FD")

			cell := ""
			if colIdx < len(row) {
				cell = row[colIdx]
			}
			if cell == "" {
				continue
			}
			pdf.SetTextColor(17, 24, 39)
			style := ""
			if isHeader {
				style = "B"
			}
			pdf.SetFont("Helvetica", style, 8)
			pdf.SetXY(cx+2, cy+cellH/2-4)
			pdf.CellFormat(cellW-4, 8, cell, "", 0, "L", false, 0, "")
		}
	}
}

// ── Fidelity export (coordinate-based — preserves exact bounding boxes) ───────

func exportFidelity(model DocumentModel, metrics map[string]map[string]float64) ([]byte, error) {
	// Build page dimension index
	dims := map[int]PageDimension{}
	for _, d := range model.PageDimensions {
		dims[d.PageIndex] = d
	}

	// Group content blocks by page
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
			y1 := block.BoundingBox[3]

			if block.Type == "shape" {
				renderShape(pdf, block, x0, y0, x1, y1)
				continue
			}

			if block.Type == "table" {
				tableW := x1 - x0
				tableH := y1 - y0
				if tableW <= 0 {
					tableW = sz.Wd - x0 - 36
				}
				if tableH <= 0 {
					tableH = 80
				}
				renderTable(pdf, block.TableData, x0, y0, tableW, tableH)
				continue
			}

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

			if !renderRichSpans(pdf, block.RichSpans, x0, y0, cellW, lh, block.FontMeta, block.Alignment, metrics) {
				pdf.SetXY(x0, y0)
				pdf.MultiCell(cellW, lh, block.Content, "", blockAlign(block.Alignment), false)
			}
		}
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("fidelity output: %w", err)
	}
	return buf.Bytes(), nil
}

// ── Shape rendering ────────────────────────────────────────────────────────────

func renderShape(pdf *fpdf.Fpdf, block Block, x0, y0, x1, y1 float64) {
	w := x1 - x0
	h := y1 - y0
	if w <= 0 || h <= 0 {
		return
	}

	r, g, b := 200, 200, 200
	if block.FontMeta != nil && block.FontMeta.Color != "" {
		r, g, b = hexToRGB(block.FontMeta.Color)
	}

	pdf.SetDrawColor(r, g, b)
	pdf.SetFillColor(r, g, b)
	pdf.Rect(x0, y0, w, h, "D")
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

	first := pageSize(dims, 0)
	pdf := fpdf.NewCustom(&fpdf.InitType{UnitStr: "pt", Size: first})

	pdf.SetTitle(model.Meta.Title, false)
	pdf.SetAuthor(model.Meta.Author, false)
	pdf.SetCreator("OLPDF Export Service", false)
	pdf.SetSubject("OLPDF "+strings.ToUpper(mode)+" Export", false)

	if mode == "pdfa" {
		// Embed XMP metadata stub for PDF/A-1b conformance marker
		pdf.SetProducer("OLPDF PDF/A-1b", false)
	}

	pdf.SetMargins(marginL, marginT, marginR)
	pdf.SetAutoPageBreak(true, marginB)
	pdf.AddPage()

	usableW := first.Wd - marginL - marginR

	// Sort all content blocks by page then y
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
			renderShape(pdf, block, block.BoundingBox[0], block.BoundingBox[1], block.BoundingBox[2], block.BoundingBox[3])
			continue
		}
		if block.Type == "table" && block.TableData != nil {
			// Estimate table height: min 10pt per row, up to page usable height
			numRows := len(block.TableData.Rows)
			if len(block.TableData.Headers) > 0 {
				numRows++
			}
			if numRows == 0 {
				numRows = 1
			}
			tableH := float64(numRows) * 14.0
			x, y := pdf.GetXY()
			renderTable(pdf, block.TableData, x, y, usableW, tableH)
			pdf.SetY(y + tableH + 8)
			continue
		}

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

		x, y := pdf.GetXY()
		if !renderRichSpans(pdf, block.RichSpans, x, y, usableW, lh, block.FontMeta, block.Alignment, metrics) {
			pdf.MultiCell(usableW, lh, block.Content, "", blockAlign(block.Alignment), false)
		} else {
			// After span rendering, move the cursor past the block
			_, curY := pdf.GetXY()
			pdf.SetY(curY + lh)
		}
		pdf.Ln(marginAfter)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("flow output: %w", err)
	}
	return buf.Bytes(), nil
}

// ── Image export (per-page JPEG → ZIP) ───────────────────────────────────────

// blockColor returns a fill colour keyed by block type for rasterised pages.
func blockColor(blockType string) color.RGBA {
	switch blockType {
	case "heading":
		return color.RGBA{30, 41, 59, 255}    // dark slate
	case "table":
		return color.RGBA{226, 232, 240, 255} // light blue-gray
	case "image":
		return color.RGBA{199, 210, 254, 255} // indigo tint
	case "form_field":
		return color.RGBA{167, 243, 208, 255} // mint
	default:
		return color.RGBA{51, 51, 51, 255}    // near-black for body text
	}
}

func exportImages(model DocumentModel, dpi int) ([]byte, error) {
	if dpi <= 0 {
		dpi = 96
	}
	scale := float64(dpi) / 72.0 // PDF points → pixels

	dims := map[int]PageDimension{}
	for _, d := range model.PageDimensions {
		dims[d.PageIndex] = d
	}

	// Collect unique page indices present in the model.
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
		sz := pageSize(dims, pi)
		imgW := int(sz.Wd * scale)
		imgH := int(sz.Ht * scale)
		if imgW <= 0 {
			imgW = int(595.28 * scale)
		}
		if imgH <= 0 {
			imgH = int(841.89 * scale)
		}

		img := image.NewRGBA(image.Rect(0, 0, imgW, imgH))
		draw.Draw(img, img.Bounds(), &image.Uniform{color.White}, image.Point{}, draw.Src)

		// Sort blocks by z_index so stacking order is correct.
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
				// Solid fill for non-text blocks.
				draw.Draw(img, blockRect, &image.Uniform{fc}, image.Point{}, draw.Src)
			} else if strings.TrimSpace(block.Content) != "" {
				// Simulate text lines as filled rectangles.
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

	// Toolkit operations (routed from BFF when Go service is available)
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
