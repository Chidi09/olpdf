// pdfWriter wraps pdfcpu to provide an fpdf-like interface for PDF generation.
// This replaced go-pdf/fpdf (v0.9.0) which produced broken table borders and
// misaligned mixed layouts.
package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

type pdfWriter struct {
	doc *model.Document
	pages   []*model.Page

	curX, curY float64
	fontSize   float64
	fontFamily string
	fontStyle  string
	fontKey    string

	textR, textG, textB float64
	drawR, drawG, drawB float64
	fillR, fillG, fillB float64

	marginL, marginR, marginT, marginB float64
	autoPageBreak bool
	autoMargin    float64

	fontSeq int
	fontMap map[string]string

	title, author, creator, subject, producer string

	pageIdx int
	pw, ph  float64

	mcidSeq int
	tagged  bool
}

func newPDFWriter(pageW, pageH float64) (*pdfWriter, error) {
	doc, err := api.CreateDocument()
	if err != nil {
		return nil, fmt.Errorf("create document: %w", err)
	}
	w := &pdfWriter{
		doc:     doc,
		pw:      pageW,
		ph:      pageH,
		marginL: 72, marginR: 72, marginT: 72, marginB: 72,
		fontSize: 11,
		fontMap:  make(map[string]string),
	}
	if err := w.addPage(pageW, pageH); err != nil {
		return nil, err
	}
	return w, nil
}

func (w *pdfWriter) addPage(pageW, pageH float64) error {
	page, err := api.AddPage(w.doc)
	if err != nil {
		return fmt.Errorf("add page: %w", err)
	}
	if page.Content == nil {
		page.Content = &bytes.Buffer{}
	}
	if page.Resources == nil {
		page.Resources = model.NewResources()
	}
	if page.MediaBox == nil {
		page.MediaBox = types.NewRectangle(0, 0, pageW, pageH)
	}
	w.pages = append(w.pages, page)
	w.pageIdx = len(w.pages) - 1
	w.curX = w.marginL
	w.curY = w.marginT
	w.pw = pageW
	w.ph = pageH
	w.mcidSeq = 0
	if w.fontKey != "" {
		w.selectFont(w.fontFamily, w.fontStyle, w.fontSize)
	}
	return nil
}

func (w *pdfWriter) page() *model.Page {
	if w.pageIdx >= 0 && w.pageIdx < len(w.pages) {
		return w.pages[w.pageIdx]
	}
	return nil
}

func (w *pdfWriter) writes(s string) {
	p := w.page()
	if p != nil && p.Content != nil {
		p.Content.WriteString(s)
	}
}

func (w *pdfWriter) writef(f string, args ...interface{}) {
	w.writes(fmt.Sprintf(f, args...))
}

func (w *pdfWriter) escapeText(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "(", "\\(")
	s = strings.ReplaceAll(s, ")", "\\)")
	return s
}

func (w *pdfWriter) selectFont(family, style string, size float64) string {
	key := family + "+" + style
	if ref, ok := w.fontMap[key]; ok {
		w.fontKey = ref
		w.fontFamily = family
		w.fontStyle = style
		w.fontSize = size
		return ref
	}
	w.fontSeq++
	ref := fmt.Sprintf("/F%d", w.fontSeq)
	w.fontMap[key] = ref

	baseName := family
	switch {
	case style == "B" && family == "Times":
		baseName = "Times-Bold"
	case style == "B":
		baseName = family + "-Bold"
	case style == "I" && family == "Times":
		baseName = "Times-Italic"
	case style == "I":
		baseName = family + "-Oblique"
	case (style == "BI" || style == "IB") && family == "Times":
		baseName = "Times-BoldItalic"
	case style == "BI" || style == "IB":
		baseName = family + "-BoldOblique"
	}

	p := w.page()
	if p != nil && p.Resources != nil {
		fd := types.IndirectRef{
			ObjectNumber: w.fontSeq,
		}
		p.Resources.Fonts[types.Name(ref)] = fd
	}

	w.fontKey = ref
	w.fontFamily = family
	w.fontStyle = style
	w.fontSize = size
	return ref
}

func (w *pdfWriter) ensureFontResources() {
	for key, ref := range w.fontMap {
		parts := strings.SplitN(key, "+", 2)
		family, style := parts[0], ""
		if len(parts) == 2 {
			style = parts[1]
		}
		p := w.page()
		if p == nil || p.Resources == nil {
			continue
		}
		if _, exists := p.Resources.Fonts[types.Name(ref)]; !exists {
			p.Resources.Fonts[types.Name(ref)] = types.IndirectRef{
				ObjectNumber: w.fontSeq,
			}
		}
		_ = family
		_ = style
	}
}

func (w *pdfWriter) setFont(family, style string, size float64) {
	w.selectFont(family, style, size)
}

func (w *pdfWriter) applyFont(fm *FontMeta) {
	family := "Helvetica"
	if fm != nil && fm.Family != "" {
		family = normalizeFontFamily(fm.Family)
	}
	w.setFont(family, fontStyle(fm), fontSize(fm))
}

func (w *pdfWriter) applyTextColor(fm *FontMeta) {
	if fm == nil || fm.Color == "" {
		w.setTextColor(0, 0, 0)
		return
	}
	r, g, b := hexToRGB(fm.Color)
	w.setTextColor(r, g, b)
}

func (w *pdfWriter) setTextColor(r, g, b int) {
	w.textR = float64(r) / 255
	w.textG = float64(g) / 255
	w.textB = float64(b) / 255
}

func (w *pdfWriter) setDrawColor(r, g, b int) {
	w.drawR = float64(r) / 255
	w.drawG = float64(g) / 255
	w.drawB = float64(b) / 255
}

func (w *pdfWriter) setFillColor(r, g, b int) {
	w.fillR = float64(r) / 255
	w.fillG = float64(g) / 255
	w.fillB = float64(b) / 255
}

func (w *pdfWriter) setXY(x, y float64) {
	w.curX = x
	w.curY = y
}

func (w *pdfWriter) getXY() (float64, float64) {
	return w.curX, w.curY
}

func (w *pdfWriter) setY(y float64) {
	w.curY = y
}

func (w *pdfWriter) ln(h float64) {
	w.curY += h
}

func (w *pdfWriter) setMargins(l, t, r float64) {
	w.marginL = l
	w.marginT = t
	w.marginR = r
}

func (w *pdfWriter) setAutoPageBreak(auto bool, margin float64) {
	w.autoPageBreak = auto
	w.autoMargin = margin
}

func (w *pdfWriter) setTitle(s string)    { w.title = s }
func (w *pdfWriter) setAuthor(s string)   { w.author = s }
func (w *pdfWriter) setCreator(s string)  { w.creator = s }
func (w *pdfWriter) setSubject(s string)  { w.subject = s }
func (w *pdfWriter) setProducer(s string) { w.producer = s }

func (w *pdfWriter) setTagged(t bool) {
	w.tagged = t
}

func (w *pdfWriter) nextMCID() int {
	w.mcidSeq++
	return w.mcidSeq
}

func (w *pdfWriter) getStringWidth(s string) float64 {
	if w.fontSize <= 0 {
		return 0
	}
	avg := 0.5
	switch w.fontFamily {
	case "Courier":
		avg = 0.6
	case "Times":
		avg = 0.45
	}
	total := 0.0
	for _, ch := range s {
		if ch == ' ' {
			total += 0.33 * w.fontSize
		} else if ch >= 0x4E00 {
			total += w.fontSize
		} else {
			total += avg * w.fontSize
		}
	}
	if total <= 0 && len(s) > 0 {
		total = avg * w.fontSize * float64(len(s))
	}
	return total
}

func (w *pdfWriter) pdfY(y, h float64) float64 {
	return w.ph - y - h
}

func (w *pdfWriter) beginText() {
	w.writes("BT\n")
}

func (w *pdfWriter) endText() {
	w.writes("ET\n")
}

func (w *pdfWriter) rect(x, y, wd, ht float64, style string) {
	py := w.ph - y - ht
	w.writef("%g %g %g %g re\n", x, py, wd, ht)
	switch {
	case strings.Contains(style, "F") && strings.Contains(style, "D"):
		w.writef("%g %g %g rg\n", w.fillR, w.fillG, w.fillB)
		w.writef("%g %g %g RG\n", w.drawR, w.drawG, w.drawB)
		w.writes("B\n")
	case strings.Contains(style, "F"):
		w.writef("%g %g %g rg\n", w.fillR, w.fillG, w.fillB)
		w.writes("f\n")
	default:
		w.writef("%g %g %g RG\n", w.drawR, w.drawG, w.drawB)
		w.writes("S\n")
	}
}

func (w *pdfWriter) line(x1, y1, x2, y2 float64) {
	w.writef("%g %g %g %g RG\n", w.drawR, w.drawG, w.drawB)
	py1 := w.ph - y1
	py2 := w.ph - y2
	w.writef("%g %g m %g %g l S\n", x1, py1, x2, py2)
}

func (w *pdfWriter) ellipse(cx, cy, rx, ry float64, style string) {
	py := w.ph - cy
	cp := 0.5522847498
	lcx, lcy := rx*cp, ry*cp
	w.writes("q\n")
	w.writef("%g %g %g %g %g %g cm\n", 1.0, 0.0, 0.0, 1.0, cx, py)
	w.writef("%g %g m\n", rx, 0.0)
	w.writef("%g %g %g %g %g %g c\n", rx, lcy, lcx, ry, 0.0, ry)
	w.writef("%g %g %g %g %g %g c\n", -lcx, ry, -rx, lcy, -rx, 0.0)
	w.writef("%g %g %g %g %g %g c\n", -rx, -lcy, -lcx, -ry, 0.0, -ry)
	w.writef("%g %g %g %g %g %g c\n", lcx, -ry, rx, -lcy, rx, 0.0)
	switch {
	case strings.Contains(style, "F") && strings.Contains(style, "D"):
		w.writef("%g %g %g rg\n", w.fillR, w.fillG, w.fillB)
		w.writes("B\n")
	case strings.Contains(style, "F"):
		w.writef("%g %g %g rg\n", w.fillR, w.fillG, w.fillB)
		w.writes("f\n")
	default:
		w.writes("S\n")
	}
	w.writes("Q\n")
}

func (w *pdfWriter) cellFormat(cellW, cellH float64, text, border string, ln int, align string, fill bool, link int, linkStr string) {
	w.writes("q\n")

	if fill || border != "" {
		py := w.ph - w.curY - cellH
		w.writef("%g %g %g %g re\n", w.curX, py, cellW, cellH)
		if fill {
			w.writef("%g %g %g rg\n", w.fillR, w.fillG, w.fillB)
		}
		if border != "" && fill {
			w.writef("%g %g %g RG\n", w.drawR, w.drawG, w.drawB)
			w.writes("B\n")
		} else if border != "" {
			w.writef("%g %g %g RG\n", w.drawR, w.drawG, w.drawB)
			w.writes("S\n")
		} else {
			w.writes("f\n")
		}
	}

	if text != "" {
		w.beginText()
		w.writef("%s %g Tf\n", w.fontKey, w.fontSize)
		w.writef("%g %g %g rg\n", w.textR, w.textG, w.textB)

		textW := w.getStringWidth(text)
		tx := w.curX + 2
		switch align {
		case "C":
			tx = w.curX + (cellW-textW)/2
		case "R":
			tx = w.curX + cellW - textW - 2
		case "L":
			tx = w.curX + 2
		}
		ty := w.ph - w.curY - cellH/2 - w.fontSize*0.3
		if ty < 0 {
			ty = w.fontSize * 0.7
		}
		w.writef("1 0 0 1 %g %g Tm\n", tx, ty)
		w.writef("(%s) Tj\n", w.escapeText(text))
		w.endText()
	}

	w.writes("Q\n")

	if ln == 1 || ln == 2 {
		w.curY += cellH
	}
}

func (w *pdfWriter) multiCell(wd, h float64, text, border, align string, fill bool) {
	if text == "" {
		return
	}
	words := strings.Fields(text)
	if len(words) == 0 {
		return
	}

	line := ""
	lineW := 0.0

	for _, word := range words {
		wordW := w.getStringWidth(word)
		spaceW := w.getStringWidth(" ")

		if line != "" && lineW+spaceW+wordW > wd {

			if w.autoPageBreak && w.curY+h > w.ph-w.autoMargin {
				w.addPage(w.pw, w.ph)
				w.curX = w.marginL
				w.curY = w.marginT
			}

			w.writes("q\n")
			py := w.ph - w.curY - h
			if fill {
				w.writef("%g %g %g rg\n", w.fillR, w.fillG, w.fillB)
				w.writef("%g %g %g %g re f\n", w.curX, py, wd, h)
			}
			w.beginText()
			w.writef("%s %g Tf\n", w.fontKey, w.fontSize)
			w.writef("%g %g %g rg\n", w.textR, w.textG, w.textB)
			tx := w.curX
			switch align {
			case "C":
				tx = w.curX + (wd-w.getStringWidth(line))/2
			case "R":
				tx = w.curX + wd - w.getStringWidth(line)
			}
			ty := w.ph - w.curY - h/2 - w.fontSize*0.3
			w.writef("1 0 0 1 %g %g Tm\n", tx, ty)
			w.writef("(%s) Tj\n", w.escapeText(line))
			w.endText()
			w.writes("Q\n")

			w.curY += h
			line = word
			lineW = wordW
			continue
		}

		if line == "" {
			line = word
			lineW = wordW
		} else {
			line += " " + word
			lineW += spaceW + wordW
		}
	}

	if line != "" {
		w.writes("q\n")
		py := w.ph - w.curY - h
		if fill {
			w.writef("%g %g %g rg\n", w.fillR, w.fillG, w.fillB)
			w.writef("%g %g %g %g re f\n", w.curX, py, wd, h)
		}
		w.beginText()
		w.writef("%s %g Tf\n", w.fontKey, w.fontSize)
		w.writef("%g %g %g rg\n", w.textR, w.textG, w.textB)
		tx := w.curX
		switch align {
		case "C":
			tx = w.curX + (wd-w.getStringWidth(line))/2
		case "R":
			tx = w.curX + wd - w.getStringWidth(line)
		}
		ty := w.ph - w.curY - h/2 - w.fontSize*0.3
		w.writef("1 0 0 1 %g %g Tm\n", tx, ty)
		w.writef("(%s) Tj\n", w.escapeText(line))
		w.endText()
		w.writes("Q\n")
		w.curY += h
	}
}

func (w *pdfWriter) renderShape(block Block, x0, y0, x1, y1 float64) {
	wd := x1 - x0
	ht := y1 - y0
	if wd <= 0 || ht <= 0 {
		return
	}
	r, g, b := 200, 200, 200
	if block.FontMeta != nil && block.FontMeta.Color != "" {
		r, g, b = hexToRGB(block.FontMeta.Color)
	}
	w.setDrawColor(r, g, b)
	w.setFillColor(r, g, b)
	w.rect(x0, y0, wd, ht, "D")
}

func (w *pdfWriter) renderTable(td *TableData, x0, y0, tableW, tableH float64) {
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

			w.setDrawColor(148, 163, 184)
			if isHeader {
				w.setFillColor(226, 232, 240)
			} else {
				w.setFillColor(255, 255, 255)
			}

			w.writes("q\n")
			py := w.ph - cy - cellH
			w.writef("%g %g %g %g re\n", cx, py, cellW, cellH)
			w.writef("%g %g %g rg\n", w.fillR, w.fillG, w.fillB)
			w.writef("%g %g %g RG\n", w.drawR, w.drawG, w.drawB)
			w.writes("B\n")
			w.writes("Q\n")

			cell := ""
			if colIdx < len(row) {
				cell = row[colIdx]
			}
			if cell == "" {
				continue
			}

			w.setTextColor(17, 24, 39)
			style := ""
			if isHeader {
				style = "B"
			}
			w.selectFont("Helvetica", style, 8)
			w.beginText()
			w.writef("%s %g Tf\n", w.fontKey, w.fontSize)
			w.writef("%g %g %g rg\n", w.textR, w.textG, w.textB)
			tx := cx + 2
			ty := w.ph - cy - cellH/2 - w.fontSize*0.3
			w.writef("1 0 0 1 %g %g Tm\n", tx, ty)
			w.writef("(%s) Tj\n", w.escapeText(cell))
			w.endText()
		}
	}
}

func (w *pdfWriter) renderRichSpans(spans []RichSpan, x0, y0, cellW, lh float64, defaultFM *FontMeta, align string, metrics map[string]map[string]float64) bool {
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
		style := ""
		isBold := span.Bold || (defaultFM != nil && defaultFM.IsBold)
		isItalic := span.Italic || (defaultFM != nil && defaultFM.IsItalic)
		if isBold {
			style += "B"
		}
		if isItalic {
			style += "I"
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

		w.selectFont(family, style, sz)

		col := "#111111"
		if span.Color != "" {
			col = span.Color
		} else if defaultFM != nil && defaultFM.Color != "" {
			col = defaultFM.Color
		}
		r, g, b := hexToRGB(col)
		w.setTextColor(r, g, b)

		metricsKey := cssFontKey(rawFamily, isBold, isItalic, sz)
		spaceW := w.getStringWidth(" ")
		if mw := measureWithMetrics(" ", metricsKey, metrics); mw >= 0 {
			spaceW = mw
		}
		tokens := tokenizeText(span.Text)

		for _, tok := range tokens {
			isSpace := strings.TrimSpace(tok) == ""
			if isSpace {
				if !firstOnLine {
					tokSpW := w.getStringWidth(tok)
					if mw := measureWithMetrics(tok, metricsKey, metrics); mw >= 0 {
						tokSpW = mw
					}
					curX += tokSpW
				}
				continue
			}

			tokW := w.getStringWidth(tok)
			if mw := measureWithMetrics(tok, metricsKey, metrics); mw >= 0 {
				tokW = mw
			}

			if !firstOnLine && curX+spaceW+tokW > x0+cellW {
				curX = x0
				curY += lh
				firstOnLine = true
			}

			if !firstOnLine {
				curX += spaceW
			}

			w.beginText()
			w.writef("%s %g Tf\n", w.fontKey, w.fontSize)
			w.writef("%g %g %g rg\n", w.textR, w.textG, w.textB)
			ty := w.ph - curY - lh/2 - w.fontSize*0.3
			w.writef("1 0 0 1 %g %g Tm\n", curX, ty)
			w.writef("(%s) Tj\n", w.escapeText(tok))
			w.endText()

			curX += tokW
			firstOnLine = false
		}
	}
	return true
}

func (w *pdfWriter) renderLayoutObject(obj LayoutObject) error {
	mcid := w.nextMCID()
	if w.tagged {
		w.writef("/MCID %d BMC\n", mcid)
	}
	switch obj.Type {
	case "text":
		family := normalizeFontFamily(obj.FontFamily)
		style := ""
		size := obj.FontSize
		if size <= 0 {
			size = 11
		}
		w.selectFont(family, style, size)
		r, g, b := hexToRGB(obj.Fill)
		if obj.Fill == "" {
			r, g, b = 0, 0, 0
		}
		w.setTextColor(r, g, b)
		cellW := obj.Width
		if cellW <= 0 {
			cellW = 200
		}
		w.multiCell(cellW, size*1.25, obj.Content, "", "", false)

	case "rect", "roundedRect":
		w.setDrawColor(0, 0, 0)
		w.setFillColor(255, 255, 255)
		if obj.Stroke != "" {
			r, g, b := hexToRGB(obj.Stroke)
			w.setDrawColor(r, g, b)
		}
		if obj.Fill != "" && obj.Fill != "transparent" {
			r, g, b := hexToRGB(obj.Fill)
			w.setFillColor(r, g, b)
			w.rect(obj.X, obj.Y, obj.Width, obj.Height, "FD")
		} else {
			w.rect(obj.X, obj.Y, obj.Width, obj.Height, "D")
		}

	case "ellipse":
		w.setDrawColor(0, 0, 0)
		w.setFillColor(255, 255, 255)
		if obj.Stroke != "" {
			r, g, b := hexToRGB(obj.Stroke)
			w.setDrawColor(r, g, b)
		}
		if obj.Fill != "" && obj.Fill != "transparent" {
			r, g, b := hexToRGB(obj.Fill)
			w.setFillColor(r, g, b)
		}
		w.ellipse(obj.X+obj.Width/2, obj.Y+obj.Height/2, obj.Width/2, obj.Height/2, "FD")

	case "line", "arrow":
		w.setDrawColor(0, 0, 0)
		if obj.Stroke != "" {
			r, g, b := hexToRGB(obj.Stroke)
			w.setDrawColor(r, g, b)
		}
		w.line(obj.X, obj.Y, obj.X+obj.Width, obj.Y+obj.Height)
	}
	if w.tagged {
		w.writes("EMC\n")
	}
	return nil
}

func (w *pdfWriter) renderLayoutObjects(page LayoutPage) error {
	for _, obj := range page.Objects {
		if err := w.renderLayoutObject(obj); err != nil {
			return fmt.Errorf("render object %s: %w", obj.ID, err)
		}
	}
	return nil
}

func (w *pdfWriter) writeTo(wr io.Writer) error {
	w.ensureFontResources()
	var buf bytes.Buffer
	ctx, err := api.ReadContext(bytes.NewReader(nil), model.NewDefaultConfiguration())
	if err != nil {
		ctx = model.NewContext(w.doc, model.NewDefaultConfiguration())
	}
	ctx.Doc = w.doc
	if err := api.WriteContext(wr, ctx); err != nil {
		return fmt.Errorf("write pdf: %w", err)
	}
	return nil
}

func (w *pdfWriter) output() ([]byte, error) {
	var buf bytes.Buffer
	if err := w.writeTo(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (w *pdfWriter) outputFileAndClose(path string) error {
	var buf bytes.Buffer
	if err := w.writeTo(&buf); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0644)
}
