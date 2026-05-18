package main

import (
	"encoding/json"
	"net/http"
	"net/url"
)

// ── Format Conversion Handlers ─────────────────────────────────────────────

func handleExtractText(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("extract-text", w, r) {
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
	path := "/api/pdf/extract-text?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

type pdfToImagesRequest struct {
	DocID  string `json:"doc_id"`
	Format string `json:"format"`
	DPI    int    `json:"dpi"`
}

func handlePdfToImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("pdf-to-images", w, r) {
		return
	}
	var req pdfToImagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/pdf-to-images?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"format": req.Format, "dpi": req.DPI})
}

func handlePdfToDocx(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("pdf-to-docx", w, r) {
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
	path := "/api/pdf/pdf-to-docx?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handlePdfToHtml(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("pdf-to-html", w, r) {
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
	path := "/api/pdf/pdf-to-html?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handlePdfToEpub(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("pdf-to-epub", w, r) {
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
	path := "/api/pdf/pdf-to-epub?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handlePdfToMarkdown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("pdf-to-markdown", w, r) {
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
	path := "/api/pdf/pdf-to-markdown?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handlePdfToExcel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("pdf-to-excel", w, r) {
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
	path := "/api/pdf/pdf-to-excel?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handlePdfToPowerpoint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("pdf-to-powerpoint", w, r) {
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
	path := "/api/pdf/pdf-to-powerpoint?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleWordToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("word-to-pdf", w, r) {
		return
	}
	proxyToolkitCall(w, r, "/api/pdf/word-to-pdf", nil)
}

func handleExcelToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("excel-to-pdf", w, r) {
		return
	}
	proxyToolkitCall(w, r, "/api/pdf/excel-to-pdf", nil)
}

func handlePowerpointToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("powerpoint-to-pdf", w, r) {
		return
	}
	proxyToolkitCall(w, r, "/api/pdf/powerpoint-to-pdf", nil)
}

func handleHtmlToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("html-to-pdf", w, r) {
		return
	}
	var req struct {
		HtmlText string `json:"html_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.HtmlText == "" {
		http.Error(w, "html_text required", http.StatusUnprocessableEntity)
		return
	}
	proxyToolkitCall(w, r, "/api/pdf/html-to-pdf", map[string]any{"html_text": req.HtmlText})
}

func handleMarkdownToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("markdown-to-pdf", w, r) {
		return
	}
	var req struct {
		MdText string `json:"md_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.MdText == "" {
		http.Error(w, "md_text required", http.StatusUnprocessableEntity)
		return
	}
	proxyToolkitCall(w, r, "/api/pdf/markdown-to-pdf", map[string]any{"md_text": req.MdText})
}

func handleJpgToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("jpg-to-pdf", w, r) {
		return
	}
	proxyToolkitCall(w, r, "/api/pdf/jpg-to-pdf", nil)
}

func handlePngToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("png-to-pdf", w, r) {
		return
	}
	proxyToolkitCall(w, r, "/api/pdf/png-to-pdf", nil)
}

func handleSvgToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("svg-to-pdf", w, r) {
		return
	}
	proxyToolkitCall(w, r, "/api/pdf/svg-to-pdf", nil)
}

// ── Content Extraction & Modification Handlers ────────────────────────────

func handleRemoveAnnotations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("remove-annotations", w, r) {
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
	path := "/api/pdf/remove-annotations?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleFlattenForms(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("flatten-forms", w, r) {
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
	path := "/api/pdf/flatten-forms?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleLinearize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("linearize", w, r) {
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
	path := "/api/pdf/linearize?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

type addPageNumbersRequest struct {
	DocID       string `json:"doc_id"`
	Text        string `json:"text"`
	StartNumber int    `json:"start_number"`
	Position    string `json:"position"`
}

func handleAddPageNumbers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("add-page-numbers", w, r) {
		return
	}
	var req addPageNumbersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/add-page-numbers?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"text": req.Text, "start_number": req.StartNumber, "position": req.Position})
}

func handleAddHeader(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("add-header", w, r) {
		return
	}
	var req struct {
		DocID string `json:"doc_id"`
		Text  string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	if req.Text == "" {
		http.Error(w, "text required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/add-header?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"text": req.Text})
}

func handleAddFooter(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("add-footer", w, r) {
		return
	}
	var req struct {
		DocID string `json:"doc_id"`
		Text  string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	if req.Text == "" {
		http.Error(w, "text required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/add-footer?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"text": req.Text})
}

func handleRemoveMetadata(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("remove-metadata", w, r) {
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
	path := "/api/pdf/remove-metadata?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

type setMetadataRequest struct {
	DocID    string `json:"doc_id"`
	Title    string `json:"title"`
	Author   string `json:"author"`
	Subject  string `json:"subject"`
	Keywords string `json:"keywords"`
}

func handleSetMetadata(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("set-metadata", w, r) {
		return
	}
	var req setMetadataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/set-metadata?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"title": req.Title, "author": req.Author, "subject": req.Subject, "keywords": req.Keywords})
}

func handleRepair(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("repair", w, r) {
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
	path := "/api/pdf/repair?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleGrayscale(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("grayscale", w, r) {
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
	path := "/api/pdf/grayscale?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleInvertColors(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("invert-colors", w, r) {
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
	path := "/api/pdf/invert-colors?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleAddBackground(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("add-background", w, r) {
		return
	}
	var req struct {
		DocID string `json:"doc_id"`
		Color string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/add-background?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"color": req.Color})
}

func handleAddStamp(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("add-stamp", w, r) {
		return
	}
	var req struct {
		DocID   string  `json:"doc_id"`
		Text    string  `json:"text"`
		Opacity float64 `json:"opacity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/add-stamp?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"text": req.Text, "opacity": req.Opacity})
}

type replaceTextRequest struct {
	DocID       string `json:"doc_id"`
	FindText    string `json:"find_text"`
	ReplaceText string `json:"replace_text"`
}

func handleReplaceText(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("replace-text", w, r) {
		return
	}
	var req replaceTextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	if req.FindText == "" {
		http.Error(w, "find_text required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/replace-text?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"find_text": req.FindText, "replace_text": req.ReplaceText})
}

func handleReplaceImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("replace-images", w, r) {
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
	path := "/api/pdf/replace-images?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleCleanup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("cleanup", w, r) {
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
	path := "/api/pdf/cleanup?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

type batesNumberingRequest struct {
	DocID       string `json:"doc_id"`
	Prefix      string `json:"prefix"`
	StartNumber int    `json:"start_number"`
}

func handleBatesNumbering(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("bates-numbering", w, r) {
		return
	}
	var req batesNumberingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/bates-numbering?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"prefix": req.Prefix, "start_number": req.StartNumber})
}

func handleOcr(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("ocr", w, r) {
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
	path := "/api/pdf/ocr?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

// ── Page & Layout Manipulation Handlers ───────────────────────────────────

type cropPagesRequest struct {
	DocID       string  `json:"doc_id"`
	X1          float64 `json:"x1"`
	Y1          float64 `json:"y1"`
	X2          float64 `json:"x2"`
	Y2          float64 `json:"y2"`
	PageIndices []int   `json:"page_indices"`
}

func handleCropPages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("crop-pages", w, r) {
		return
	}
	var req cropPagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/crop-pages?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"x1": req.X1, "y1": req.Y1, "x2": req.X2, "y2": req.Y2, "page_indices": req.PageIndices})
}

type extractPagesRequest struct {
	DocID      string      `json:"doc_id"`
	PageRanges []pageRange `json:"page_ranges"`
}

func handleExtractPages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("extract-pages", w, r) {
		return
	}
	var req extractPagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/extract-pages?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"page_ranges": req.PageRanges})
}

type deletePagesRequest struct {
	DocID       string `json:"doc_id"`
	PageIndices []int  `json:"page_indices"`
}

func handleDeletePages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("delete-pages", w, r) {
		return
	}
	var req deletePagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/delete-pages?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"page_indices": req.PageIndices})
}

type reorderPagesRequest struct {
	DocID    string `json:"doc_id"`
	NewOrder []int  `json:"new_order"`
}

func handleReorderPages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("reorder-pages", w, r) {
		return
	}
	var req reorderPagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/reorder-pages?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"new_order": req.NewOrder})
}

type scalePagesRequest struct {
	DocID      string `json:"doc_id"`
	TargetSize string `json:"target_size"`
}

func handleScalePages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("scale-pages", w, r) {
		return
	}
	var req scalePagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/scale-pages?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"target_size": req.TargetSize})
}

func handleRemoveBlankPages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("remove-blank-pages", w, r) {
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
	path := "/api/pdf/remove-blank-pages?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleRemoveMargins(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("remove-margins", w, r) {
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
	path := "/api/pdf/remove-margins?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleAddMargins(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("add-margins", w, r) {
		return
	}
	var req struct {
		DocID      string  `json:"doc_id"`
		MarginSize float64 `json:"margin_size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/add-margins?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"margin_size": req.MarginSize})
}

func handleReversePages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("reverse-pages", w, r) {
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
	path := "/api/pdf/reverse-pages?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

type resizePdfRequest struct {
	DocID  string  `json:"doc_id"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

func handleResizePdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("resize-pdf", w, r) {
		return
	}
	var req resizePdfRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/resize-pdf?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"width": req.Width, "height": req.Height})
}

func handleDeskew(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("deskew", w, r) {
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
	path := "/api/pdf/deskew?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

type splitBySizeRequest struct {
	DocID string  `json:"doc_id"`
	MaxMB float64 `json:"max_mb"`
}

func handleSplitBySize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("split-by-size", w, r) {
		return
	}
	var req splitBySizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/split-by-size?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"max_mb": req.MaxMB})
}

func handleSplitByBookmarks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("split-by-bookmarks", w, r) {
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
	path := "/api/pdf/split-by-bookmarks?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleBookletPrinting(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("booklet-printing", w, r) {
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
	path := "/api/pdf/booklet-printing?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

type nUpRequest struct {
	DocID         string `json:"doc_id"`
	PagesPerSheet int    `json:"pages_per_sheet"`
}

func handleNUp(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("n-up", w, r) {
		return
	}
	var req nUpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/n-up?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"pages_per_sheet": req.PagesPerSheet})
}

type setInitialViewRequest struct {
	DocID  string `json:"doc_id"`
	Zoom   string `json:"zoom"`
	Layout string `json:"layout"`
}

func handleSetInitialView(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("set-initial-view", w, r) {
		return
	}
	var req setInitialViewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/set-initial-view?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"zoom": req.Zoom, "layout": req.Layout})
}

// ── Bookmark, Attachment & Asset Handlers ─────────────────────────────────

func handleRemoveBookmarks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("remove-bookmarks", w, r) {
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
	path := "/api/pdf/remove-bookmarks?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleCreateBookmarks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("create-bookmarks", w, r) {
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
	path := "/api/pdf/create-bookmarks?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleExtractFonts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("extract-fonts", w, r) {
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
	path := "/api/pdf/extract-fonts?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleEmbedFonts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("embed-fonts", w, r) {
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
	path := "/api/pdf/embed-fonts?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleUnembedFonts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("unembed-fonts", w, r) {
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
	path := "/api/pdf/unembed-fonts?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleExtractAttachments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("extract-attachments", w, r) {
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
	path := "/api/pdf/extract-attachments?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleAddAttachments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("add-attachments", w, r) {
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
	path := "/api/pdf/add-attachments?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleExtractTables(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("extract-tables", w, r) {
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
	path := "/api/pdf/extract-tables?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleExtractLinks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("extract-links", w, r) {
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
	path := "/api/pdf/extract-links?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleExtractFormData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("extract-form-data", w, r) {
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
	path := "/api/pdf/extract-form-data?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleRemoveJavascript(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("remove-javascript", w, r) {
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
	path := "/api/pdf/remove-javascript?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

// ── Security & Validation Handlers ────────────────────────────────────────

type removePasswordsRequest struct {
	DocID    string `json:"doc_id"`
	Password string `json:"password"`
}

func handleRemovePasswords(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("remove-passwords", w, r) {
		return
	}
	var req removePasswordsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/remove-passwords?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"password": req.Password})
}

type redactTextRequest struct {
	DocID       string `json:"doc_id"`
	Pattern     string `json:"pattern"`
	Replacement string `json:"replacement"`
}

func handleRedactText(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("redact-text", w, r) {
		return
	}
	var req redactTextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	if req.Pattern == "" {
		http.Error(w, "pattern required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/redact-text?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"pattern": req.Pattern, "replacement": req.Replacement})
}

type comparePdfsRequest struct {
	DocID        string `json:"doc_id"`
	CompareDocID string `json:"compare_doc_id"`
}

func handleComparePdfs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("compare-pdfs", w, r) {
		return
	}
	var req comparePdfsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	if req.CompareDocID == "" {
		http.Error(w, "compare_doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/compare-pdfs?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"compare_doc_id": req.CompareDocID})
}

func handleValidatePdfa(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("validate-pdfa", w, r) {
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
	path := "/api/pdf/validate-pdfa?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

type signPdfRequest struct {
	DocID    string `json:"doc_id"`
	Reason   string `json:"reason"`
	Location string `json:"location"`
}

func handleSignPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("sign-pdf", w, r) {
		return
	}
	var req signPdfRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DocID == "" {
		http.Error(w, "doc_id required", http.StatusUnprocessableEntity)
		return
	}
	path := "/api/pdf/sign-pdf?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, map[string]any{"reason": req.Reason, "location": req.Location})
}

func handleVerifySignature(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("verify-signature", w, r) {
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
	path := "/api/pdf/verify-signature?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handlePrintToPdf(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("print-to-pdf", w, r) {
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
	path := "/api/pdf/print-to-pdf?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handleMeasureDimensions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("measure-dimensions", w, r) {
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
	path := "/api/pdf/measure-dimensions?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}

func handlePdfaConversion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if handleAsync("pdfa-conversion", w, r) {
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
	path := "/api/pdf/pdfa-conversion?doc_id=" + url.QueryEscape(req.DocID)
	proxyToolkitCall(w, r, path, nil)
}
