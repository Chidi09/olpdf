"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DocumentDuplicateIcon,
  ScissorsIcon,
  ArrowsPointingInIcon,
  ArrowPathIcon,
  SparklesIcon,
  LockClosedIcon,
  NoSymbolIcon,
  PhotoIcon,
  DocumentMagnifyingGlassIcon,
  PencilSquareIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  BookOpenIcon,
  CodeBracketIcon,
  TableCellsIcon,
  RectangleGroupIcon,
  ChatBubbleLeftRightIcon,
  AdjustmentsHorizontalIcon,
  SunIcon,
  WrenchIcon,
  EyeSlashIcon,
  BookmarkIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentListIcon,
  LinkIcon,
  CheckBadgeIcon,
  PrinterIcon,
  ScaleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { PageShell } from "@/components/layout/PageShell";
import { useToolkitStore } from "@/store/useToolkitStore";
import { useToastStore } from "@/store/useToastStore";
import { InlineSpinner, HelperText } from "@/components/ui/MicroUI";
import { ToolkitResultCard } from "@/components/toolkit/ToolkitResultCard";
import { PdfJobCard } from "@/components/toolkit/PdfJobCard";
import { usePdfWasm } from "@/hooks/usePdfWasm";
import { usePdfJob } from "@/hooks/usePdfJob";

type MicroStatus = { state: "idle" | "working" | "success" | "error"; label: string; detail?: string };

type OperationDef = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  needsDoc: boolean;
  bodyless: boolean;
  showForm: boolean;
  helpText: string;
  category: string;
};

type CategoryDef = {
  id: string;
  title: string;
  operations: OperationDef[];
};

const CATEGORIES: CategoryDef[] = [
  {
    id: "general",
    title: "General",
    operations: [
      { id: "merge", title: "Merge PDFs", description: "Combine multiple files into one PDF.", icon: DocumentDuplicateIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Select two or more documents to merge into a single PDF.", category: "general" },
      { id: "split", title: "Split PDF", description: "Extract specific pages.", icon: ScissorsIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Enter page ranges like 1-3, 5, 8-10 to extract.", category: "general" },
      { id: "compress", title: "Compress", description: "Reduce file size.", icon: ArrowsPointingInIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Optimize PDF size by removing redundant data.", category: "general" },
      { id: "rotate", title: "Rotate", description: "Rotate pages 90/180 deg.", icon: ArrowPathIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Choose rotation angle and select which pages to rotate.", category: "general" },
      { id: "watermark", title: "Watermark", description: "Apply visible marks.", icon: SparklesIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Add a diagonal text watermark to every page.", category: "general" },
      { id: "protect", title: "Protect", description: "Apply encryption.", icon: LockClosedIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Password-protect with AES-256 encryption.", category: "general" },
      { id: "area-redact", title: "Area Redact", description: "Remove sensitive areas.", icon: NoSymbolIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Define rectangular areas on pages to redact. Coordinates are in PDF points (72 pts = 1 inch).", category: "general" },
      { id: "extract-images", title: "Extract Images", description: "Export embedded media.", icon: PhotoIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Extract all embedded images from the PDF.", category: "general" },
      { id: "detect-forms", title: "Detect Forms", description: "Identify fillable fields.", icon: DocumentMagnifyingGlassIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Scan the PDF for fillable form fields.", category: "general" },
      { id: "fill-forms", title: "Fill Forms", description: "Programmatically fill.", icon: PencilSquareIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Fill form fields with values. Use 'Detect Forms' first to see available fields.", category: "general" },
    ],
  },
  {
    id: "format-conversions",
    title: "Format Conversions",
    operations: [
      { id: "extract-text", title: "Extract Text", description: "Extract readable text from PDF.", icon: DocumentTextIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Extract all readable text from the PDF as plain text.", category: "format-conversions" },
      { id: "pdf-to-images", title: "PDF to Images", description: "Rasterize each page to PNG/JPG.", icon: PhotoIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Convert each page to an image file (PNG or JPG).", category: "format-conversions" },
      { id: "pdf-to-docx", title: "PDF to Word", description: "Convert to Word document.", icon: DocumentDuplicateIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Convert the PDF to a DOCX file.", category: "format-conversions" },
      { id: "pdf-to-html", title: "PDF to HTML", description: "Convert to web layout.", icon: CodeBracketIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Convert the PDF to an HTML web page.", category: "format-conversions" },
      { id: "pdf-to-epub", title: "PDF to EPUB", description: "Convert to e-reader format.", icon: BookOpenIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Convert the PDF to an EPUB e-book.", category: "format-conversions" },
      { id: "pdf-to-markdown", title: "PDF to Markdown", description: "Extract text and headings to MD.", icon: DocumentTextIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Convert the PDF content to Markdown format.", category: "format-conversions" },
      { id: "pdf-to-excel", title: "PDF to Excel", description: "Extract tables to XLSX/CSV.", icon: TableCellsIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Extract tables from the PDF into a spreadsheet.", category: "format-conversions" },
      { id: "pdf-to-powerpoint", title: "PDF to PowerPoint", description: "Convert presentation layouts to PPTX.", icon: RectangleGroupIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Convert the PDF to a PowerPoint presentation.", category: "format-conversions" },
      { id: "word-to-pdf", title: "Word to PDF", description: "Convert DOCX to PDF.", icon: DocumentDuplicateIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Upload a DOCX file and convert it to PDF.", category: "format-conversions" },
      { id: "excel-to-pdf", title: "Excel to PDF", description: "Convert XLSX to PDF.", icon: TableCellsIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Upload an XLSX file and convert it to PDF.", category: "format-conversions" },
      { id: "powerpoint-to-pdf", title: "PowerPoint to PDF", description: "Convert PPTX to PDF.", icon: RectangleGroupIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Upload a PPTX file and convert it to PDF.", category: "format-conversions" },
      { id: "html-to-pdf", title: "HTML to PDF", description: "Print HTML layout to PDF.", icon: CodeBracketIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Convert HTML markup or a URL to PDF.", category: "format-conversions" },
      { id: "markdown-to-pdf", title: "Markdown to PDF", description: "Convert MD text to PDF.", icon: DocumentTextIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Convert Markdown text to a styled PDF.", category: "format-conversions" },
      { id: "jpg-to-pdf", title: "JPG to PDF", description: "Wrap JPEG images in PDF.", icon: PhotoIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Upload a JPEG image and wrap it in a PDF.", category: "format-conversions" },
      { id: "png-to-pdf", title: "PNG to PDF", description: "Wrap PNG images in PDF.", icon: PhotoIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Upload a PNG image and wrap it in a PDF.", category: "format-conversions" },
      { id: "svg-to-pdf", title: "SVG to PDF", description: "Convert SVG vector graphic to PDF.", icon: PhotoIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Upload an SVG graphic and convert it to PDF.", category: "format-conversions" },
    ],
  },
  {
    id: "extraction-modification",
    title: "Content Extraction & Modification",
    operations: [
      { id: "remove-annotations", title: "Remove Annotations", description: "Strip comments, highlights, drawings.", icon: ChatBubbleLeftRightIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Remove all annotations (comments, highlights, drawings) from the PDF.", category: "extraction-modification" },
      { id: "flatten-forms", title: "Flatten Forms", description: "Make interactive fields static.", icon: DocumentDuplicateIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Convert interactive form fields to static content.", category: "extraction-modification" },
      { id: "linearize", title: "Linearize", description: "Optimize for Fast Web View.", icon: ArrowPathIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Optimize the PDF for fast web streaming.", category: "extraction-modification" },
      { id: "add-page-numbers", title: "Add Page Numbers", description: "Stamp pagination on each page.", icon: DocumentTextIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Add page numbers to every page.", category: "extraction-modification" },
      { id: "add-header", title: "Add Header", description: "Insert top margin text.", icon: DocumentTextIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Add a header line to the top of every page.", category: "extraction-modification" },
      { id: "add-footer", title: "Add Footer", description: "Insert bottom margin text.", icon: DocumentTextIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Add a footer line to the bottom of every page.", category: "extraction-modification" },
      { id: "remove-metadata", title: "Remove Metadata", description: "Strip Exif and document info.", icon: NoSymbolIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Remove all document metadata and Exif data.", category: "extraction-modification" },
      { id: "set-metadata", title: "Set Metadata", description: "Change Title, Author, Keywords.", icon: DocumentDuplicateIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Set or update the document metadata fields.", category: "extraction-modification" },
      { id: "repair", title: "Repair", description: "Fix broken XREF tables.", icon: WrenchIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Attempt to repair a corrupted PDF.", category: "extraction-modification" },
      { id: "grayscale", title: "Grayscale", description: "Convert all colors to B/W.", icon: AdjustmentsHorizontalIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Convert all color content to grayscale.", category: "extraction-modification" },
      { id: "invert-colors", title: "Invert Colors", description: "Invert colors for dark mode.", icon: SunIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Invert all colors in the PDF.", category: "extraction-modification" },
      { id: "add-background", title: "Add Background", description: "Apply solid color behind content.", icon: PhotoIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Add a solid color background to every page.", category: "extraction-modification" },
      { id: "add-stamp", title: "Add Stamp", description: "Overlay rubber stamp annotations.", icon: SparklesIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Add a text stamp annotation to every page.", category: "extraction-modification" },
      { id: "replace-text", title: "Replace Text", description: "Find and replace text sequences.", icon: PencilSquareIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Find and replace specific text within the PDF.", category: "extraction-modification" },
      { id: "replace-images", title: "Replace Images", description: "Swap embedded images.", icon: PhotoIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Replace embedded images with placeholder or blank images.", category: "extraction-modification" },
      { id: "cleanup", title: "Cleanup", description: "Garbage collect unused objects.", icon: SparklesIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Remove unused objects and reduce file size.", category: "extraction-modification" },
      { id: "bates-numbering", title: "Bates Numbering", description: "Apply Bates stamps.", icon: DocumentTextIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Apply sequential Bates numbering to each page.", category: "extraction-modification" },
      { id: "ocr", title: "OCR", description: "Make scanned images searchable.", icon: DocumentMagnifyingGlassIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Run OCR on scanned pages to make text searchable.", category: "extraction-modification" },
    ],
  },
  {
    id: "page-layout",
    title: "Page & Layout Manipulation",
    operations: [
      { id: "crop-pages", title: "Crop Pages", description: "Apply crop box to pages.", icon: ScissorsIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Crop pages to a bounding box. Coordinates in PDF points.", category: "page-layout" },
      { id: "extract-pages", title: "Extract Pages", description: "Pull specific pages into new PDF.", icon: ScissorsIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Extract specific pages into a new PDF document.", category: "page-layout" },
      { id: "delete-pages", title: "Delete Pages", description: "Remove specific pages.", icon: MinusIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Delete specific pages from the PDF.", category: "page-layout" },
      { id: "reorder-pages", title: "Reorder Pages", description: "Change page sequence.", icon: ArrowPathIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Reorder pages by specifying the new order as comma-separated page indices.", category: "page-layout" },
      { id: "scale-pages", title: "Scale Pages", description: "Resize page dimensions.", icon: ArrowsPointingInIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Scale pages to a standard page size.", category: "page-layout" },
      { id: "remove-blank-pages", title: "Remove Blank Pages", description: "Auto-detect and drop empty pages.", icon: EyeSlashIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Automatically detect and remove blank pages.", category: "page-layout" },
      { id: "remove-margins", title: "Remove Margins", description: "Auto-crop white borders.", icon: ArrowsPointingInIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Automatically crop white borders from all pages.", category: "page-layout" },
      { id: "add-margins", title: "Add Margins", description: "Pad pages with white space.", icon: ArrowsPointingInIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Add white space margins around each page.", category: "page-layout" },
      { id: "reverse-pages", title: "Reverse Pages", description: "Reverse page order.", icon: ArrowPathIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Reverse the order of all pages in the PDF.", category: "page-layout" },
      { id: "resize-pdf", title: "Resize PDF", description: "Change document dimensions.", icon: ArrowsPointingInIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Resize the PDF to custom width and height.", category: "page-layout" },
      { id: "deskew", title: "Deskew", description: "Straighten crooked/scanned pages.", icon: AdjustmentsHorizontalIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Straighten crooked scanned pages.", category: "page-layout" },
      { id: "split-by-size", title: "Split by Size", description: "Split by max file size.", icon: ScissorsIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Split the PDF into parts each under a maximum file size.", category: "page-layout" },
      { id: "split-by-bookmarks", title: "Split by Bookmarks", description: "Split into chapters by outline.", icon: BookmarkIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Split the PDF into separate files based on bookmark/outline structure.", category: "page-layout" },
      { id: "booklet-printing", title: "Booklet Printing", description: "Impose pages for booklet.", icon: RectangleGroupIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Rearrange pages for booklet-style printing.", category: "page-layout" },
      { id: "n-up", title: "N-Up", description: "Impose multiple pages per sheet.", icon: RectangleGroupIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Place multiple pages on each sheet of paper.", category: "page-layout" },
      { id: "set-initial-view", title: "Set Initial View", description: "Configure default Zoom/Layout.", icon: AdjustmentsHorizontalIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Configure the default zoom level and page layout when the PDF opens.", category: "page-layout" },
    ],
  },
  {
    id: "bookmarks-assets",
    title: "Bookmarks, Attachments & Assets",
    operations: [
      { id: "remove-bookmarks", title: "Remove Bookmarks", description: "Delete document outline.", icon: BookmarkIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Remove all bookmarks from the PDF.", category: "bookmarks-assets" },
      { id: "create-bookmarks", title: "Create Bookmarks", description: "Generate outline from headings.", icon: BookmarkIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Generate bookmarks from document heading structure.", category: "bookmarks-assets" },
      { id: "extract-fonts", title: "Extract Fonts", description: "Save embedded TTF/OTF files.", icon: DocumentTextIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Extract all embedded font files from the PDF.", category: "bookmarks-assets" },
      { id: "embed-fonts", title: "Embed Fonts", description: "Force font embedding.", icon: DocumentTextIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Force embed all fonts used in the PDF.", category: "bookmarks-assets" },
      { id: "unembed-fonts", title: "Unembed Fonts", description: "Remove embedded fonts.", icon: DocumentTextIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Remove embedded fonts to reduce file size.", category: "bookmarks-assets" },
      { id: "extract-attachments", title: "Extract Attachments", description: "Save embedded files.", icon: ClipboardDocumentIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Extract all embedded file attachments.", category: "bookmarks-assets" },
      { id: "add-attachments", title: "Add Attachments", description: "Embed files into PDF.", icon: ClipboardDocumentIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Attach a file to the PDF document.", category: "bookmarks-assets" },
      { id: "extract-tables", title: "Extract Tables", description: "Detect and export tables to CSV.", icon: TableCellsIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Detect and extract tabular data to CSV.", category: "bookmarks-assets" },
      { id: "extract-links", title: "Extract Links", description: "Dump all URIs and links.", icon: LinkIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Extract all hyperlinks and URIs from the PDF.", category: "bookmarks-assets" },
      { id: "extract-form-data", title: "Extract Form Data", description: "Dump field values to CSV/JSON.", icon: ClipboardDocumentListIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Extract all form field values from fillable forms.", category: "bookmarks-assets" },
      { id: "remove-javascript", title: "Remove JavaScript", description: "Strip executable JS.", icon: NoSymbolIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Remove all JavaScript actions from the PDF.", category: "bookmarks-assets" },
    ],
  },
  {
    id: "security-validation",
    title: "Security & Validation",
    operations: [
      { id: "remove-passwords", title: "Remove Passwords", description: "Unlock PDF if password is known.", icon: LockClosedIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Remove password protection from a PDF.", category: "security-validation" },
      { id: "redact-text", title: "Redact by Regex", description: "Auto blackout by pattern.", icon: NoSymbolIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Redact all text matching a regex pattern (e.g. SSN, emails).", category: "security-validation" },
      { id: "compare-pdfs", title: "Compare PDFs", description: "Generate visual diff.", icon: DocumentDuplicateIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Compare two PDFs and generate a visual diff.", category: "security-validation" },
      { id: "validate-pdfa", title: "Validate PDF/A", description: "Check archival compliance.", icon: CheckBadgeIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Check if the PDF meets PDF/A archival standards.", category: "security-validation" },
      { id: "sign-pdf", title: "Sign PDF", description: "Apply digital signature.", icon: PencilSquareIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Sign the PDF with reason and location metadata.", category: "security-validation" },
      { id: "verify-signature", title: "Verify Signature", description: "Check certificate validity.", icon: CheckBadgeIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Verify the digital signature on a signed PDF.", category: "security-validation" },
      { id: "print-to-pdf", title: "Print to PDF", description: "Re-print to strip weird encodings.", icon: PrinterIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Re-render the PDF to strip unusual encodings.", category: "security-validation" },
      { id: "measure-dimensions", title: "Measure Dimensions", description: "Report exact page sizes.", icon: ScaleIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Get the exact dimensions of every page.", category: "security-validation" },
      { id: "pdfa-conversion", title: "PDF/A Conversion", description: "Convert to PDF/A archive format.", icon: DocumentDuplicateIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Convert the PDF to PDF/A archival format.", category: "security-validation" },
    ],
  },
];

const ALL_OPERATIONS: OperationDef[] = CATEGORIES.flatMap((c) => c.operations);

function SelectField({
  label, value, onChange, options, helper,
}: {
  label: string; value: string | number; onChange: (v: string) => void; options: { value: string; label: string }[]; helper?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</label>
      <select value={String(value)} onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]">
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {helper && <HelperText>{helper}</HelperText>}
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder, helper, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; helper?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] placeholder:text-[var(--text-tertiary)]" />
      {helper && <HelperText>{helper}</HelperText>}
    </div>
  );
}

function FileField({
  label, onChange, accept, helper,
}: {
  label: string; onChange: (file: File | null) => void; accept: string; helper?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</label>
      <div className="flex gap-2">
        <button onClick={() => ref.current?.click()}
          className="flex h-9 items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)]">
          <PlusIcon className="h-3.5 w-3.5" /> Choose File
        </button>
        <span className="flex items-center text-xs text-[var(--text-tertiary)] truncate">{name || "No file selected"}</span>
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        setName(f?.name ?? "");
        onChange(f);
      }} />
      {helper && <HelperText>{helper}</HelperText>}
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max, step, helper,
}: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; helper?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} min={min} max={max} step={step}
        className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
      {helper && <HelperText>{helper}</HelperText>}
    </div>
  );
}

export default function ToolkitPage() {
  const { activeOperationId, inputValue, running, result, setActiveOperationId, setInputValue, setRunning, setResult } = useToolkitStore();
  const toast = useToastStore((s) => s.toast);
  const { preflightPdf, ready: wasmReady } = usePdfWasm();
  const [documents, setDocuments] = useState<Array<{ id: string; title?: string }>>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [formValues, setFormValues] = useState<Record<string, unknown>>({
    mergeDocIds: [] as string[],
    splitRanges: "",
    rotation: 90,
    pageIndices: "",
    watermarkText: "CONFIDENTIAL",
    watermarkOpacity: 0.15,
    userPassword: "",
    ownerPassword: "",
    redactAreas: "",
    fillFormPayload: "",
    imageFormat: "png",
    imageDpi: 150,
    htmlInput: "",
    htmlMode: "html",
    markdownInput: "",
    pageNumberText: "{page}",
    pageNumberStart: 1,
    pageNumberPosition: "bottom-center",
    headerText: "",
    footerText: "",
    metadataTitle: "",
    metadataAuthor: "",
    metadataSubject: "",
    metadataKeywords: "",
    backgroundColor: "#ffffff",
    stampText: "DRAFT",
    stampOpacity: 0.3,
    findText: "",
    replaceText: "",
    batesPrefix: "",
    batesStart: 1,
    cropX1: 0, cropY1: 0, cropX2: 612, cropY2: 792,
    extractPagesRanges: "",
    deletePagesIndices: "",
    reorderPagesOrder: "",
    scaleTargetSize: "A4",
    marginSize: 36,
    resizeWidth: 612,
    resizeHeight: 792,
    splitMaxMb: 10,
    nUpPagesPerSheet: 2,
    initialViewZoom: "100",
    initialViewLayout: "single",
    removePassword: "",
    redactRegex: "",
    compareSecondDocId: "",
    signReason: "",
    signLocation: "",
  });
  const [uploadStatus, setUploadStatus] = useState<MicroStatus>({ state: "idle", label: "No upload running" });
  const [operationStatus, setOperationStatus] = useState<MicroStatus>({ state: "idle", label: "Ready" });
  const [preflightInfo, setPreflightInfo] = useState<{ page_count: number; dimensions: string } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["general"]));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mobileCategory, setMobileCategory] = useState("general");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = ALL_OPERATIONS.find((o) => o.id === activeOperationId) ?? ALL_OPERATIONS[0];
  const fv = formValues;

  const setFv = (key: string, value: unknown) => setFormValues((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const mobileOps = CATEGORIES.find((c) => c.id === mobileCategory)?.operations ?? [];

  useEffect(() => {
    fetch("/api/bff/documents")
      .then((r) => (r.ok ? r.json() : []))
      .then((raw: unknown) => {
        const rows = Array.isArray(raw) ? raw as Array<{ id: string; title?: string }> : [];
        setDocuments(rows);
        if (!selectedDocumentId && rows.length) setSelectedDocumentId(rows[0].id);
      })
      .catch(() => setDocuments([]));
  }, [selectedDocumentId]);

  const buildPayload = useMemo(() => {
    return () => {
      const docId = selectedDocumentId;
      switch (active.id) {
        case "merge":
          return { doc_ids: (fv.mergeDocIds as string[])?.length > 0 ? (fv.mergeDocIds as string[]) : [docId] };
        case "split":
          return {
            doc_id: docId,
            page_ranges: String(fv.splitRanges ?? "").split(",").map((s) => {
              const trimmed = s.trim();
              const parts = trimmed.split("-");
              return parts.length === 2 ? { start: parseInt(parts[0]), end: parseInt(parts[1]) } : { start: parseInt(trimmed), end: parseInt(trimmed) };
            }),
          };
        case "rotate":
          return {
            doc_id: docId,
            rotation: (fv.rotation as number) ?? 90,
            page_indices: fv.pageIndices ? String(fv.pageIndices).split(",").map((s) => parseInt(s.trim())) : undefined,
          };
        case "watermark":
          return { doc_id: docId, text: String(fv.watermarkText ?? "CONFIDENTIAL"), opacity: (fv.watermarkOpacity as number) ?? 0.15 };
        case "protect":
          return { doc_id: docId, user_password: String(fv.userPassword ?? ""), owner_password: String(fv.ownerPassword ?? "") };
        case "area-redact": {
          let areas: Array<{ page_number: number; bbox: number[] }> = [];
          try { areas = JSON.parse(String(fv.redactAreas ?? "")); } catch { areas = [{ page_number: 0, bbox: [72, 72, 180, 96] }]; }
          return { doc_id: docId, areas };
        }
        case "fill-forms": {
          let fields: Record<string, string> = {};
          try { fields = JSON.parse(String(fv.fillFormPayload ?? "")); } catch { fields = {}; }
          return { doc_id: docId, payload: fields };
        }
        case "pdf-to-images":
          return { doc_id: docId, format: String(fv.imageFormat ?? "png"), dpi: (fv.imageDpi as number) ?? 150 };
        case "word-to-pdf":
        case "excel-to-pdf":
        case "powerpoint-to-pdf":
        case "jpg-to-pdf":
        case "png-to-pdf":
        case "svg-to-pdf":
          return { file_data: String(fv.fileData ?? ""), filename: String(fv.fileName ?? ""), target_format: "pdf" };
        case "html-to-pdf":
          if (String(fv.htmlMode ?? "html") === "url") return { url: String(fv.htmlInput ?? "") };
          return { html: String(fv.htmlInput ?? "") };
        case "markdown-to-pdf":
          return { markdown: String(fv.markdownInput ?? "") };
        case "add-page-numbers":
          return { doc_id: docId, text: String(fv.pageNumberText ?? "{page}"), start_number: (fv.pageNumberStart as number) ?? 1, position: String(fv.pageNumberPosition ?? "bottom-center") };
        case "add-header":
          return { doc_id: docId, text: String(fv.headerText ?? "") };
        case "add-footer":
          return { doc_id: docId, text: String(fv.footerText ?? "") };
        case "set-metadata":
          return { doc_id: docId, title: String(fv.metadataTitle ?? ""), author: String(fv.metadataAuthor ?? ""), subject: String(fv.metadataSubject ?? ""), keywords: String(fv.metadataKeywords ?? "") };
        case "add-background":
          return { doc_id: docId, color: String(fv.backgroundColor ?? "#ffffff") };
        case "add-stamp":
          return { doc_id: docId, text: String(fv.stampText ?? "DRAFT"), opacity: (fv.stampOpacity as number) ?? 0.3 };
        case "replace-text":
          return { doc_id: docId, find_text: String(fv.findText ?? ""), replace_text: String(fv.replaceText ?? "") };
        case "bates-numbering":
          return { doc_id: docId, prefix: String(fv.batesPrefix ?? ""), start_number: (fv.batesStart as number) ?? 1 };
        case "crop-pages":
          return { doc_id: docId, bbox: [(fv.cropX1 as number) ?? 0, (fv.cropY1 as number) ?? 0, (fv.cropX2 as number) ?? 612, (fv.cropY2 as number) ?? 792] };
        case "extract-pages":
          return { doc_id: docId, page_ranges: String(fv.extractPagesRanges ?? "") };
        case "delete-pages":
          return { doc_id: docId, page_indices: String(fv.deletePagesIndices ?? "").split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)) };
        case "reorder-pages":
          return { doc_id: docId, new_order: String(fv.reorderPagesOrder ?? "").split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)) };
        case "scale-pages":
          return { doc_id: docId, target_size: String(fv.scaleTargetSize ?? "A4") };
        case "add-margins":
          return { doc_id: docId, margin_size: (fv.marginSize as number) ?? 36 };
        case "resize-pdf":
          return { doc_id: docId, width: (fv.resizeWidth as number) ?? 612, height: (fv.resizeHeight as number) ?? 792 };
        case "split-by-size":
          return { doc_id: docId, max_mb: (fv.splitMaxMb as number) ?? 10 };
        case "n-up":
          return { doc_id: docId, pages_per_sheet: (fv.nUpPagesPerSheet as number) ?? 2 };
        case "set-initial-view":
          return { doc_id: docId, zoom: String(fv.initialViewZoom ?? "100"), layout: String(fv.initialViewLayout ?? "single") };
        case "remove-passwords":
          return { doc_id: docId, password: String(fv.removePassword ?? "") };
        case "redact-text":
          return { doc_id: docId, pattern: String(fv.redactRegex ?? "") };
        case "compare-pdfs":
          return { doc_id: docId, second_doc_id: String(fv.compareSecondDocId ?? "") };
        case "sign-pdf":
          return { doc_id: docId, reason: String(fv.signReason ?? ""), location: String(fv.signLocation ?? "") };
        case "add-attachments":
          return { doc_id: docId, file_data: String(fv.fileData ?? ""), filename: String(fv.fileName ?? "") };
        case "extract-text":
        case "pdf-to-docx":
        case "pdf-to-html":
        case "pdf-to-epub":
        case "pdf-to-markdown":
        case "pdf-to-excel":
        case "pdf-to-powerpoint":
        case "remove-annotations":
        case "flatten-forms":
        case "linearize":
        case "remove-metadata":
        case "repair":
        case "grayscale":
        case "invert-colors":
        case "replace-images":
        case "cleanup":
        case "ocr":
        case "remove-blank-pages":
        case "remove-margins":
        case "reverse-pages":
        case "deskew":
        case "split-by-bookmarks":
        case "booklet-printing":
        case "remove-bookmarks":
        case "create-bookmarks":
        case "extract-fonts":
        case "embed-fonts":
        case "unembed-fonts":
        case "extract-attachments":
        case "extract-tables":
        case "extract-links":
        case "extract-form-data":
        case "remove-javascript":
        case "validate-pdfa":
        case "verify-signature":
        case "print-to-pdf":
        case "measure-dimensions":
        case "pdfa-conversion":
        case "compress":
        case "extract-images":
        case "detect-forms":
          return { doc_id: docId };
        default:
          return { doc_id: docId };
      }
    };
  }, [active.id, selectedDocumentId, formValues]);

  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const latestJobId = activeJobIds[activeJobIds.length - 1] ?? null;
  const { job: latestJob, dismiss: dismissLatest, isDismissed: isLatestDismissed } = usePdfJob(latestJobId);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("failed_to_read_file"));
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        resolve(dataUrl.split(",")[1] || "");
      };
      reader.readAsDataURL(file);
    });
  };

  const runOperation = async () => {
    setRunning(true);
    setOperationStatus({ state: "working", label: "Processing", detail: active.title });
    let payload: Record<string, unknown>;
    try {
      payload = inputValue.trim() && showAdvanced ? JSON.parse(inputValue) : buildPayload();
    } catch {
      toast("Invalid configuration. Check form values.", "error");
      setRunning(false);
      return;
    }

    setOperationStatus({ state: "working", label: "Running", detail: `${active.title} is executing.` });
    setResult(null);

    try {
      const response = await fetch(`/api/bff/toolkit/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || data?.detail || "Toolkit operation failed";
        setResult({ status: "error", message, detail: data?.detail || "", ...data });
        setOperationStatus({ state: "error", label: "Failed", detail: message });
        toast(message, "error");
        return;
      }
      if (response.status === 202 && data?.job_id) {
        setActiveJobIds((prev) => [...prev, data.job_id]);
        setOperationStatus({ state: "success", label: "Queued", detail: `${active.title} queued in Go processor.` });
        toast("Operation queued — check progress below.", "info");
        return;
      }
      setResult(data);
      const summary = data?.url ? "Result file ready" : data?.urls ? `${data.urls.length} files ready` : data?.count ? `${data.count} images extracted` : "Completed";
      setOperationStatus({ state: "success", label: "Success", detail: summary });
      toast(summary, "success");
    } catch {
      setResult({ status: "error", message: "Network error" });
      setOperationStatus({ state: "error", label: "Network error" });
    } finally {
      setRunning(false);
    }
  };

  const importPdf = async (file: File | null) => {
    if (!file) return;
    setUploadStatus({ state: "working", label: "Creating document", detail: file.name });
    const createRes = await fetch("/api/bff/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: file.name.replace(/\.pdf$/i, "") || "Imported PDF" }),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !created?.id) {
      setUploadStatus({ state: "error", label: "Upload failed" });
      return;
    }

    setUploadStatus({ state: "working", label: "Reading PDF" });
    const arrayBuffer = await file.arrayBuffer();

    if (wasmReady) {
      try {
        const preflight = await preflightPdf(arrayBuffer);
        const firstDims = preflight.page_dimensions?.[0];
        const dimStr = firstDims ? `${Math.round(firstDims.width)}×${Math.round(firstDims.height)} pt` : "";
        setPreflightInfo({ page_count: preflight.page_count, dimensions: dimStr });
      } catch { }
    }

    setUploadStatus({ state: "working", label: "Uploading PDF" });

    const useMultipart = file.size > 5 * 1024 * 1024;
    let importRes: Response | null = null;

    if (useMultipart) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_id", created.id);
      formData.append("owner_id", "");

      importRes = await fetch("/api/bff/import/upload", {
        method: "POST",
        body: formData,
      }).catch(() => null);
    } else {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("failed_to_read_file"));
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          resolve(dataUrl.split(",")[1] || "");
        };
        reader.readAsDataURL(file);
      });

      importRes = await fetch("/api/bff/import/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: created.id, fileBytes: base64, layout_mode: "fidelity" }),
      }).catch(() => null);
    }

    if (!importRes?.ok) {
      setUploadStatus({ state: "error", label: "Upload failed", detail: "The PDF could not be stored for toolkit operations." });
      toast("Upload failed. Try another PDF or refresh and try again.", "error");
      return;
    }

    setDocuments((prev) => [{ id: created.id, title: file.name }, ...prev]);
    setSelectedDocumentId(created.id);
    setUploadStatus({ state: "success", label: "Upload finished", detail: `${file.name} ready.` });
    toast("PDF uploaded and ready for toolkit operations.", "success");
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    const base64 = await readFileAsBase64(file);
    setFv("fileData", base64);
    setFv("fileName", file.name);
  };

  const StatusPill = ({ status }: { status: MicroStatus }) => {
    const activeState = status.state === "working";
    const tone = status.state === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : status.state === "error" ? "border-red-500/25 bg-red-500/10 text-red-300"
      : status.state === "working" ? "border-orange-500/25 bg-orange-500/10 text-orange-300"
      : "border-white/10 bg-white/[0.03] text-[var(--text-tertiary)]";
    return (
      <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${tone}`}>
        {activeState ? <InlineSpinner className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
        <span className="font-semibold">{status.label}</span>
        {status.detail && <span className="hidden max-w-[260px] truncate text-[var(--text-tertiary)] sm:inline">{status.detail}</span>}
      </div>
    );
  };

  const renderFormFields = (): ReactNode => {
    switch (active.id) {
      case "split":
        return (
          <TextField label="Page Ranges" value={String(fv.splitRanges ?? "")} onChange={(v) => setFv("splitRanges", v)} placeholder="e.g. 0-1, 3, 5-7" helper="Comma-separated page ranges. Pages are 0-indexed." />
        );
      case "rotate":
        return (
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Rotation" value={(fv.rotation as number) ?? 90} onChange={(v) => setFv("rotation", parseInt(v))}
              options={[
                { value: "90", label: "90° clockwise" },
                { value: "180", label: "180°" },
                { value: "270", label: "270° clockwise (90° CCW)" },
              ]} />
            <TextField label="Pages (optional)" value={String(fv.pageIndices ?? "")} onChange={(v) => setFv("pageIndices", v)} placeholder="All pages if empty" helper="Comma-separated 0-indexed page numbers." />
          </div>
        );
      case "watermark":
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Text" value={String(fv.watermarkText ?? "CONFIDENTIAL")} onChange={(v) => setFv("watermarkText", v)} placeholder="CONFIDENTIAL" />
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Opacity ({Math.round(((fv.watermarkOpacity as number) ?? 0.15) * 100)}%)</label>
              <input type="range" min="0" max="100" value={Math.round(((fv.watermarkOpacity as number) ?? 0.15) * 100)}
                onChange={(e) => setFv("watermarkOpacity", parseInt(e.target.value) / 100)}
                className="h-9 w-full accent-[var(--accent)]" />
            </div>
          </div>
        );
      case "protect":
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="User Password" type="password" value={String(fv.userPassword ?? "")} onChange={(v) => setFv("userPassword", v)} placeholder="Required to open" />
            <TextField label="Owner Password" type="password" value={String(fv.ownerPassword ?? "")} onChange={(v) => setFv("ownerPassword", v)} placeholder="Required to modify permissions" />
          </div>
        );
      case "area-redact":
        return (
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Redaction Areas (JSON)</label>
            <textarea value={String(fv.redactAreas ?? "")} onChange={(e) => setFv("redactAreas", e.target.value)} rows={4}
              placeholder='[{"page_number": 0, "bbox": [72, 72, 180, 96]}]'
              className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 font-mono text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
            <HelperText>Array of areas with page_number and bbox [x1, y1, x2, y2] in PDF points.</HelperText>
          </div>
        );
      case "fill-forms":
        return (
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Form Values (JSON)</label>
            <textarea value={String(fv.fillFormPayload ?? "")} onChange={(e) => setFv("fillFormPayload", e.target.value)} rows={4}
              placeholder='{"full_name": "John Doe", "date": "2026-05-13"}'
              className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 font-mono text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
            <HelperText>Key-value pairs mapping form field names to values.</HelperText>
          </div>
        );
      case "pdf-to-images":
        return (
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Image Format" value={String(fv.imageFormat ?? "png")} onChange={(v) => setFv("imageFormat", v)}
              options={[
                { value: "png", label: "PNG (lossless)" },
                { value: "jpg", label: "JPEG (smaller)" },
              ]} />
            <NumberField label="DPI" value={(fv.imageDpi as number) ?? 150} onChange={(v) => setFv("imageDpi", v)} min={72} max={600} helper="Resolution in dots per inch." />
          </div>
        );
      case "word-to-pdf":
        return <FileField label="DOCX File" onChange={(f) => handleFileUpload(f)} accept=".docx,.doc" helper="Upload a Word document to convert to PDF." />;
      case "excel-to-pdf":
        return <FileField label="XLSX File" onChange={(f) => handleFileUpload(f)} accept=".xlsx,.xls" helper="Upload an Excel spreadsheet to convert to PDF." />;
      case "powerpoint-to-pdf":
        return <FileField label="PPTX File" onChange={(f) => handleFileUpload(f)} accept=".pptx,.ppt" helper="Upload a PowerPoint file to convert to PDF." />;
      case "html-to-pdf":
        return (
          <div className="space-y-4">
            <SelectField label="Input Mode" value={String(fv.htmlMode ?? "html")} onChange={(v) => setFv("htmlMode", v)}
              options={[
                { value: "html", label: "HTML Markup" },
                { value: "url", label: "URL" },
              ]} />
            {String(fv.htmlMode ?? "html") === "url" ? (
              <TextField label="URL" value={String(fv.htmlInput ?? "")} onChange={(v) => setFv("htmlInput", v)} placeholder="https://example.com" helper="Enter a URL to convert to PDF." />
            ) : (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">HTML Markup</label>
                <textarea value={String(fv.htmlInput ?? "")} onChange={(e) => setFv("htmlInput", e.target.value)} rows={6}
                  placeholder="<html><body><h1>Hello World</h1></body></html>"
                  className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 font-mono text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
                <HelperText>Enter raw HTML markup to convert to PDF.</HelperText>
              </div>
            )}
          </div>
        );
      case "markdown-to-pdf":
        return (
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Markdown Text</label>
            <textarea value={String(fv.markdownInput ?? "")} onChange={(e) => setFv("markdownInput", e.target.value)} rows={6}
              placeholder="# Title&#10;Hello world"
              className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 font-mono text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
            <HelperText>Enter Markdown text to convert to a styled PDF.</HelperText>
          </div>
        );
      case "jpg-to-pdf":
        return <FileField label="JPEG Image" onChange={(f) => handleFileUpload(f)} accept=".jpg,.jpeg" helper="Upload a JPEG image to wrap in a PDF." />;
      case "png-to-pdf":
        return <FileField label="PNG Image" onChange={(f) => handleFileUpload(f)} accept=".png" helper="Upload a PNG image to wrap in a PDF." />;
      case "svg-to-pdf":
        return <FileField label="SVG File" onChange={(f) => handleFileUpload(f)} accept=".svg" helper="Upload an SVG graphic to convert to PDF." />;
      case "add-page-numbers":
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Text Template" value={String(fv.pageNumberText ?? "{page}")} onChange={(v) => setFv("pageNumberText", v)} placeholder="{page}" helper="Use {page} for page number, {total} for total pages." />
            <NumberField label="Start Number" value={(fv.pageNumberStart as number) ?? 1} onChange={(v) => setFv("pageNumberStart", v)} min={1} helper="Page number to start from." />
            <SelectField label="Position" value={String(fv.pageNumberPosition ?? "bottom-center")} onChange={(v) => setFv("pageNumberPosition", v)}
              options={[
                { value: "bottom-center", label: "Bottom Center" },
                { value: "bottom-left", label: "Bottom Left" },
                { value: "bottom-right", label: "Bottom Right" },
                { value: "top-center", label: "Top Center" },
                { value: "top-left", label: "Top Left" },
                { value: "top-right", label: "Top Right" },
              ]} />
          </div>
        );
      case "add-header":
        return <TextField label="Header Text" value={String(fv.headerText ?? "")} onChange={(v) => setFv("headerText", v)} placeholder="Confidential" helper="Text to appear at the top of every page." />;
      case "add-footer":
        return <TextField label="Footer Text" value={String(fv.footerText ?? "")} onChange={(v) => setFv("footerText", v)} placeholder="Page {page}" helper="Text to appear at the bottom of every page." />;
      case "set-metadata":
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Title" value={String(fv.metadataTitle ?? "")} onChange={(v) => setFv("metadataTitle", v)} placeholder="Document Title" />
            <TextField label="Author" value={String(fv.metadataAuthor ?? "")} onChange={(v) => setFv("metadataAuthor", v)} placeholder="Author Name" />
            <TextField label="Subject" value={String(fv.metadataSubject ?? "")} onChange={(v) => setFv("metadataSubject", v)} placeholder="Subject" />
            <TextField label="Keywords" value={String(fv.metadataKeywords ?? "")} onChange={(v) => setFv("metadataKeywords", v)} placeholder="keyword1, keyword2" />
          </div>
        );
      case "add-background":
        return (
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Background Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={String(fv.backgroundColor ?? "#ffffff")} onChange={(e) => setFv("backgroundColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-[var(--border-strong)] bg-transparent" />
              <span className="text-xs font-mono text-[var(--text-tertiary)]">{String(fv.backgroundColor ?? "#ffffff")}</span>
            </div>
            <HelperText>Choose a solid background color for all pages.</HelperText>
          </div>
        );
      case "add-stamp":
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Stamp Text" value={String(fv.stampText ?? "DRAFT")} onChange={(v) => setFv("stampText", v)} placeholder="DRAFT" />
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Opacity ({Math.round(((fv.stampOpacity as number) ?? 0.3) * 100)}%)</label>
              <input type="range" min="0" max="100" value={Math.round(((fv.stampOpacity as number) ?? 0.3) * 100)}
                onChange={(e) => setFv("stampOpacity", parseInt(e.target.value) / 100)}
                className="h-9 w-full accent-[var(--accent)]" />
            </div>
          </div>
        );
      case "replace-text":
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Find Text" value={String(fv.findText ?? "")} onChange={(v) => setFv("findText", v)} placeholder="Text to find" />
            <TextField label="Replace With" value={String(fv.replaceText ?? "")} onChange={(v) => setFv("replaceText", v)} placeholder="Replacement text" />
          </div>
        );
      case "bates-numbering":
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Prefix" value={String(fv.batesPrefix ?? "")} onChange={(v) => setFv("batesPrefix", v)} placeholder="ABC-" helper="Prefix before the number." />
            <NumberField label="Start Number" value={(fv.batesStart as number) ?? 1} onChange={(v) => setFv("batesStart", v)} min={1} helper="Starting Bates number." />
          </div>
        );
      case "crop-pages":
        return (
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="X1 (left)" value={(fv.cropX1 as number) ?? 0} onChange={(v) => setFv("cropX1", v)} min={0} />
            <NumberField label="Y1 (bottom)" value={(fv.cropY1 as number) ?? 0} onChange={(v) => setFv("cropY1", v)} min={0} />
            <NumberField label="X2 (right)" value={(fv.cropX2 as number) ?? 612} onChange={(v) => setFv("cropX2", v)} min={0} />
            <NumberField label="Y2 (top)" value={(fv.cropY2 as number) ?? 792} onChange={(v) => setFv("cropY2", v)} min={0} />
            <HelperText>Crop box coordinates in PDF points (72 pts = 1 inch).</HelperText>
          </div>
        );
      case "extract-pages":
        return <TextField label="Page Ranges" value={String(fv.extractPagesRanges ?? "")} onChange={(v) => setFv("extractPagesRanges", v)} placeholder="e.g. 0-3, 5, 7-9" helper="Comma-separated ranges of pages to extract." />;
      case "delete-pages":
        return <TextField label="Page Indices" value={String(fv.deletePagesIndices ?? "")} onChange={(v) => setFv("deletePagesIndices", v)} placeholder="e.g. 1, 3, 5" helper="Comma-separated 0-indexed page numbers to delete." />;
      case "reorder-pages":
        return <TextField label="New Order" value={String(fv.reorderPagesOrder ?? "")} onChange={(v) => setFv("reorderPagesOrder", v)} placeholder="e.g. 2, 0, 1, 3" helper="Comma-separated page indices in the desired order." />;
      case "scale-pages":
        return (
          <SelectField label="Target Size" value={String(fv.scaleTargetSize ?? "A4")} onChange={(v) => setFv("scaleTargetSize", v)}
            options={[
              { value: "A4", label: "A4 (210 × 297 mm)" },
              { value: "Letter", label: "Letter (8.5 × 11 in)" },
              { value: "Legal", label: "Legal (8.5 × 14 in)" },
              { value: "A3", label: "A3 (297 × 420 mm)" },
              { value: "A5", label: "A5 (148 × 210 mm)" },
              { value: "Tabloid", label: "Tabloid (11 × 17 in)" },
            ]} />
        );
      case "add-margins":
        return <NumberField label="Margin Size (pts)" value={(fv.marginSize as number) ?? 36} onChange={(v) => setFv("marginSize", v)} min={0} max={200} helper="White space to add around each page in PDF points." />;
      case "resize-pdf":
        return (
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Width (pts)" value={(fv.resizeWidth as number) ?? 612} onChange={(v) => setFv("resizeWidth", v)} min={72} max={5000} />
            <NumberField label="Height (pts)" value={(fv.resizeHeight as number) ?? 792} onChange={(v) => setFv("resizeHeight", v)} min={72} max={5000} />
          </div>
        );
      case "split-by-size":
        return <NumberField label="Max Size (MB)" value={(fv.splitMaxMb as number) ?? 10} onChange={(v) => setFv("splitMaxMb", v)} min={1} max={100} helper="Split so each part is at most this many MB." />;
      case "n-up":
        return (
          <SelectField label="Pages Per Sheet" value={String(fv.nUpPagesPerSheet ?? "2")} onChange={(v) => setFv("nUpPagesPerSheet", parseInt(v))}
            options={[
              { value: "2", label: "2-up (2 pages per sheet)" },
              { value: "4", label: "4-up (4 pages per sheet)" },
              { value: "6", label: "6-up (6 pages per sheet)" },
              { value: "8", label: "8-up (8 pages per sheet)" },
              { value: "16", label: "16-up (16 pages per sheet)" },
            ]} />
        );
      case "set-initial-view":
        return (
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Zoom Level" value={String(fv.initialViewZoom ?? "100")} onChange={(v) => setFv("initialViewZoom", v)}
              options={[
                { value: "50", label: "50%" },
                { value: "75", label: "75%" },
                { value: "100", label: "100%" },
                { value: "125", label: "125%" },
                { value: "150", label: "150%" },
                { value: "200", label: "200%" },
                { value: "fit-page", label: "Fit Page" },
                { value: "fit-width", label: "Fit Width" },
              ]} />
            <SelectField label="Page Layout" value={String(fv.initialViewLayout ?? "single")} onChange={(v) => setFv("initialViewLayout", v)}
              options={[
                { value: "single", label: "Single Page" },
                { value: "continuous", label: "Continuous" },
                { value: "facing", label: "Facing (Two-Up)" },
                { value: "continuous-facing", label: "Continuous Facing" },
              ]} />
          </div>
        );
      case "remove-passwords":
        return <TextField label="Document Password" type="password" value={String(fv.removePassword ?? "")} onChange={(v) => setFv("removePassword", v)} placeholder="Enter password to unlock" helper="The password required to open the PDF." />;
      case "redact-text":
        return <TextField label="Regex Pattern" value={String(fv.redactRegex ?? "")} onChange={(v) => setFv("redactRegex", v)} placeholder="\b\d{3}-\d{2}-\d{4}\b" helper="Regex pattern to match sensitive text (e.g. SSN, email). Tests are case-insensitive." />;
      case "compare-pdfs":
        return (
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Second Document</label>
            <select value={String(fv.compareSecondDocId ?? "")} onChange={(e) => setFv("compareSecondDocId", e.target.value)}
              className="h-9 w-full appearance-none rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]">
              <option value="">Select a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title || doc.id}</option>
              ))}
            </select>
            <HelperText>Select the second document to compare against.</HelperText>
          </div>
        );
      case "sign-pdf":
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Reason" value={String(fv.signReason ?? "")} onChange={(v) => setFv("signReason", v)} placeholder="e.g. Document Review" helper="Reason for signing." />
            <TextField label="Location" value={String(fv.signLocation ?? "")} onChange={(v) => setFv("signLocation", v)} placeholder="e.g. New York" helper="Location of the signing." />
          </div>
        );
      case "add-attachments":
        return <FileField label="File to Attach" onChange={(f) => handleFileUpload(f)} accept="*/*" helper="Select any file to embed into the PDF." />;
      default:
        return null;
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl space-y-10">
        {/* Header */}
        <div className="border-b border-border-subtle pb-8 relative">
          <div className="absolute -left-12 -top-12 h-64 w-64 rounded-full bg-accent/5 blur-[100px] pointer-events-none" />
          <div className="relative z-10">
            <h1 className="font-sans text-3xl font-black tracking-tighter text-text-primary uppercase italic">Power Toolkit</h1>
            <p className="mt-2 font-sans text-sm font-medium text-text-secondary max-w-2xl leading-relaxed">
               Advanced atomic PDF operations. Precise control over binary structures, metadata streams, and visual layers.
               <span className="ml-2 font-mono text-[10px] text-accent opacity-80 select-none">[v2.1_STABLE]</span>
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <StatusPill status={uploadStatus} />
            <StatusPill status={operationStatus} />
            {preflightInfo && (
              <div className="flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-accent shadow-sm">
                <span>{preflightInfo.page_count} Pages</span>
                <div className="h-1 w-1 rounded-full bg-accent/40" />
                <span>{preflightInfo.dimensions}</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile category+operation selector */}
        <div className="grid gap-3 lg:hidden">
          <div className="relative">
            <select value={mobileCategory} onChange={(e) => setMobileCategory(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl liquid-glass border border-border-strong px-4 text-sm font-bold text-text-primary outline-none">
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.title.toUpperCase()}</option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
          </div>
          <div className="relative">
            <select value={activeOperationId} onChange={(e) => { setActiveOperationId(e.target.value); setResult(null); setOperationStatus({ state: "idle", label: "Ready" }); }}
              className="h-11 w-full appearance-none rounded-xl liquid-glass border border-border-strong px-4 text-sm font-bold text-text-primary outline-none">
              {mobileOps.map((op) => (
                <option key={op.id} value={op.id}>{op.title}</option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Sidebar — desktop */}
          <div className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-24 space-y-2">
              <div className="flex items-center justify-between px-2 mb-4">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary opacity-60">System Modules</span>
              </div>
              {CATEGORIES.map((cat) => {
                const isExpanded = expandedCategories.has(cat.id);
                return (
                  <div key={cat.id} className={cn(
                    "overflow-hidden rounded-xl transition-all duration-300",
                    isExpanded ? "liquid-glass-strong border border-border-strong shadow-lg" : "liquid-glass border border-border-subtle"
                  )}>
                    <button onClick={() => toggleCategory(cat.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/5">
                      <span className={cn(
                        "font-sans text-[11px] font-black uppercase tracking-widest transition-colors",
                        isExpanded ? "text-accent" : "text-text-tertiary"
                      )}>{cat.title}</span>
                      <ChevronDownIcon className={cn("h-3 w-3 text-text-tertiary transition-transform duration-300", isExpanded && "rotate-180 text-accent")} />
                    </button>
                    {isExpanded && (
                      <div className="space-y-1 px-2 pb-3 pt-1 border-t border-border-subtle/40 bg-black/20">
                        {cat.operations.map((op) => {
                          const isActive = active.id === op.id;
                          return (
                            <button key={op.id} onClick={() => { setActiveOperationId(op.id); setResult(null); setOperationStatus({ state: "idle", label: "Ready" }); }}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-all group",
                                isActive
                                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                                  : "text-text-secondary hover:bg-surface/80 hover:text-text-primary"
                              )}>
                              <div className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-lg border transition-colors",
                                isActive ? "border-white/20 bg-white/10" : "border-border-subtle bg-background group-hover:border-accent/40"
                              )}>
                                <op.icon className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-text-tertiary group-hover:text-accent")} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-sans text-xs font-black uppercase tracking-tight leading-none">{op.title}</div>
                                <div className={cn(
                                  "mt-1 font-sans text-[10px] font-medium leading-tight truncate opacity-60",
                                  isActive && "text-white/80"
                                )}>{op.description}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main panel */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex flex-col overflow-hidden rounded-2xl liquid-glass-strong border border-border-strong shadow-panel group">
              {/* Card Header */}
              <div className="relative border-b border-border-subtle bg-surface/30 px-8 py-6">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <active.icon className="h-16 w-16" />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-accent/20 bg-accent/5 shadow-inner">
                    <active.icon className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xl font-black tracking-tight text-text-primary uppercase italic">{active.title}</h3>
                    {active.helpText && <p className="font-sans text-xs font-medium text-text-tertiary leading-relaxed mt-1">{active.helpText}</p>}
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="space-y-8 p-8 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/[0.01] to-transparent pointer-events-none" />

                {/* Target Selection */}
                {(active.needsDoc || active.id === "merge") && active.id !== "merge" && (
                  <div className="space-y-3 relative z-10">
                    <label className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary opacity-70">Source Document</label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <select value={selectedDocumentId} onChange={(e) => setSelectedDocumentId(e.target.value)}
                          className="h-11 w-full appearance-none rounded-xl border border-border-strong bg-background/50 px-4 pr-10 font-sans text-sm font-bold text-text-primary outline-none focus:border-accent transition-all">
                          <option value="">Select a document...</option>
                          {documents.map((doc) => (
                            <option key={doc.id} value={doc.id}>{doc.title || doc.id}</option>
                          ))}
                        </select>
                        <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                      </div>
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploadStatus.state === "working"}
                        className="flex h-11 items-center gap-3 rounded-xl border-2 border-border-strong bg-surface px-6 font-sans text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:bg-hover hover:border-accent/40 disabled:opacity-50">
                        {uploadStatus.state === "working" ? <InlineSpinner className="h-4 w-4 text-accent" /> : <CloudArrowUpIcon className="h-4 w-4" />}
                        {uploadStatus.state === "working" ? "Streaming..." : "Upload New"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Merge specific document selector */}
                {active.id === "merge" && (
                  <div className="space-y-4">
                    <label className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary opacity-70">Job Queue</label>
                    <div className="space-y-3">
                      <div className="relative">
                        <select
                          onChange={(e) => {
                            if (e.target.value && !(fv.mergeDocIds as string[])?.includes(e.target.value)) {
                              setFv("mergeDocIds", [...(fv.mergeDocIds as string[] || []), e.target.value]);
                            }
                          }}
                          className="h-11 w-full appearance-none rounded-xl border border-border-strong bg-background/50 px-4 pr-10 font-sans text-sm font-bold text-text-primary outline-none focus:border-accent transition-all">
                          <option value="">Register document for merge...</option>
                          {documents.map((doc) => (
                            <option key={doc.id} value={doc.id}>{doc.title || doc.id}</option>
                          ))}
                        </select>
                        <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                      </div>
                      {(fv.mergeDocIds as string[] || []).length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(fv.mergeDocIds as string[]).map((id: string) => {
                            const doc = documents.find((d) => d.id === id);
                            return (
                              <div key={id} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface/50 p-3 backdrop-blur-sm animate-reveal">
                                <div className="flex items-center gap-3 min-w-0">
                                   <div className="h-2 w-2 rounded-full bg-accent/40" />
                                   <span className="text-xs font-bold text-text-primary truncate">{doc?.title || id}</span>
                                </div>
                                <button onClick={() => setFv("mergeDocIds", (fv.mergeDocIds as string[] || []).filter((x: string) => x !== id))}
                                  className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-text-tertiary hover:text-red-500 transition-colors">
                                   <XMarkIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="relative z-10">{renderFormFields()}</div>

                {active.bodyless && active.needsDoc && (
                  <div className="rounded-xl border border-border-subtle bg-accent/5 p-4 backdrop-blur-sm flex items-start gap-3">
                    <DocumentMagnifyingGlassIcon className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    <p className="font-sans text-xs font-medium text-text-secondary leading-relaxed">This atomic operation requires no additional configuration parameters. The agent will execute the transformation using backend defaults.</p>
                  </div>
                )}
              </div>

              {/* Advanced JSON toggle */}
              <div className="border-t border-border-subtle bg-surface/30 px-8 py-4">
                <button onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary hover:text-text-primary transition-colors">
                  <div className={cn("h-1.5 w-1.5 rounded-full", showAdvanced ? "bg-accent" : "bg-text-tertiary")} />
                  Override Kernel Config
                </button>
                {showAdvanced && (
                  <div className="mt-4 animate-reveal">
                    <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} rows={6} placeholder="Enter raw JSON kernel payload..."
                      className="w-full resize-none rounded-xl border border-border-strong bg-black p-5 font-mono text-[11px] text-emerald-400 outline-none transition-all focus:border-accent/40 shadow-inner" spellCheck={false} />
                    <div className="mt-2 flex items-center gap-2 opacity-60">
                       <CommandLineIcon className="h-3 w-3" />
                       <span className="font-mono text-[9px] text-text-tertiary uppercase tracking-widest">Manual Payload Inversion Enabled</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border-subtle bg-black/40 px-8 py-5">
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="font-mono text-[10px] font-black uppercase tracking-widest text-text-tertiary">System Status: Idle</span>
                </div>
                <button
                  onClick={runOperation}
                  disabled={running || (!selectedDocumentId && active.needsDoc)}
                  className="group relative h-12 flex items-center gap-3 overflow-hidden rounded-xl bg-white px-8 font-sans text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {running ? <InlineSpinner className="h-4 w-4 text-black" /> : <CpuChipIcon className="h-4 w-4" />}
                  {running ? "Synthesizing..." : `Commit ${active.title}`}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </button>
              </div>
            </div>

            {/* Result display */}
            <div className="animate-reveal">
              {result && (
                <ToolkitResultCard result={result} operation={active.id} />
              )}
              {latestJob && !isLatestDismissed && (
                <PdfJobCard job={latestJob} operation={active.id} onDismiss={dismissLatest} />
              )}
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void importPdf(e.target.files?.[0] || null)} />
      </div>
    </PageShell>
  );
}
