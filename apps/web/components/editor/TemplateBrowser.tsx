
"use client";
import { DocumentModel } from "@olpdf/document-model";

const templates: { id: string; title: string; model: DocumentModel }[] = [
  {
    id: "bus-prop",
    title: "Business Proposal",
    model: {
      id: "00000000-0000-0000-0000-000000000001",
      meta: {
        title: "Business Proposal",
        author: "",
        page_size: "A4",
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        export_standard: "pdf_a",
        layout_mode: "editable",
      },
      styles: { font_family: "Lora" },
      page_dimensions: [],
      blocks: [
        { id: "tpl-h1", type: "heading1", content: "Executive Summary", z_index: 0, page_index: 0, float: "none" },
        { id: "tpl-p1", type: "paragraph", content: "{{COMPANY_NAME}} proposes the following scope.", z_index: 0, page_index: 0, float: "none" },
      ],
    },
  },
];

export default function TemplateBrowser({ onSelect }: { onSelect: (model: DocumentModel) => void }) {
    return (
        <div className="p-4 bg-slate-800">
            <h3 className="text-white font-bold mb-2">Templates</h3>
            {templates.map(t => (
                <button key={t.id} onClick={() => onSelect(t.model)} className="block w-full text-left p-2 hover:bg-slate-700 text-slate-300">
                    {t.title}
                </button>
            ))}
        </div>
    );
}
