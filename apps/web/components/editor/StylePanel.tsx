
"use client";
import { DocumentModel } from "@olpdf/document-model";

type StyleMap = Record<string, string | number>;

export default function StylePanel({ model, onChange }: { model: DocumentModel, onChange: (m: DocumentModel) => void }) {
    const styles: StyleMap = (model.styles as StyleMap) || {};

    return (
        <div className="w-64 bg-slate-900 text-white p-4 border-l border-slate-700 h-full">
            <h3 className="font-bold mb-4">Document Styles</h3>
            <label className="block text-xs text-slate-400">Font Family</label>
            <select className="w-full bg-slate-800 p-2 mb-4 rounded" value={(styles.font_family as string) || "Lora"} onChange={(e) => onChange({...model, styles: {...styles, font_family: e.target.value}})}>
                <option value="Lora">Lora</option>
                <option value="DM Sans">DM Sans</option>
            </select>

            <label className="block text-xs text-slate-400">Base Font Size</label>
            <input
              type="number"
              className="w-full bg-slate-800 p-2 mb-4 rounded"
              value={Number(styles.base_font_size || 11)}
              onChange={(e) => onChange({ ...model, styles: { ...styles, base_font_size: Number(e.target.value) || 11 } })}
            />

            <label className="block text-xs text-slate-400">Body Color</label>
            <input
              type="color"
              className="w-full bg-slate-800 p-2 mb-4 rounded"
              value={(styles.body_color as string) || "#2d2d2d"}
              onChange={(e) => onChange({ ...model, styles: { ...styles, body_color: e.target.value } })}
            />

            <label className="block text-xs text-slate-400">Vertical Margin</label>
            <input
              type="number"
              className="w-full bg-slate-800 p-2 rounded"
              value={Number(styles.margin_vertical || 72)}
              onChange={(e) => onChange({ ...model, styles: { ...styles, margin_vertical: Number(e.target.value) || 72 } })}
            />
        </div>
    );
}
