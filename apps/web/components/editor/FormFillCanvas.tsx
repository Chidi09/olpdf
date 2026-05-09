"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { DocumentModel } from "@olpdf/document-model";

interface FormFillCanvasProps {
  documentId: string;
  model: DocumentModel;
}

export function FormFillCanvas({ documentId, model }: FormFillCanvasProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLFormElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const pages = useMemo(() => {
    const dims = model.page_dimensions ?? [];
    return dims.map((dim) => ({
      ...dim,
      fields: (model.blocks ?? []).filter((b) => (b.page_index ?? 0) === dim.page_index && b.type === "field"),
    }));
  }, [model]);

  const primaryWidth = pages[0]?.width ?? 595.28;
  const scale = Math.max(0.4, Math.min(1.5, containerWidth / primaryWidth));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/bff/forms/${documentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: values }),
    });
    if (res.ok) setSubmitted(true);
  };

  return (
    <form ref={containerRef} onSubmit={handleSubmit} className="mx-auto max-w-[900px] space-y-6 p-6">
      {submitted && <div className="rounded bg-emerald-600 px-3 py-2 text-sm text-white">Submission received.</div>}
      {pages.map((page) => (
        <div key={page.page_index} className="relative rounded bg-white shadow" style={{ width: page.width * scale, height: page.height * scale }}>
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#fafafa,#fafafa_12px,#f5f5f5_12px,#f5f5f5_24px)]" />
          {page.fields.map((field) => {
            const bbox = field.bounding_box ?? [0, 0, 160, 28];
            const [x0, y0, x1, y1] = bbox;
            const fieldId = (field as any).field_id ?? field.id;
            const fieldType = (field as any).field_type ?? "text";
            const label = (field as any).label ?? "Field";
            return (
              <div
                key={fieldId}
                className="absolute"
                style={{ left: x0 * scale, top: y0 * scale, width: (x1 - x0) * scale, minHeight: Math.max((y1 - y0) * scale, 24) }}
              >
                <label className="mb-1 block text-[10px] font-semibold text-slate-700">{label}</label>
                {fieldType === "multiline" ? (
                  <textarea
                    value={values[fieldId] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [fieldId]: e.target.value }))}
                    className="h-20 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                ) : fieldType === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={values[fieldId] === "true"}
                    onChange={(e) => setValues((prev) => ({ ...prev, [fieldId]: String(e.target.checked) }))}
                    className="h-4 w-4"
                  />
                ) : fieldType === "select" ? (
                  <select
                    value={values[fieldId] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [fieldId]: e.target.value }))}
                    className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                  >
                    <option value="">Select…</option>
                    {((field as any).options as string[] | undefined)?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={fieldType === "date" ? "date" : "text"}
                    value={values[fieldId] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [fieldId]: e.target.value }))}
                    placeholder={(field as any).placeholder ?? ""}
                    className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
      <button type="submit" className="rounded bg-[var(--accent)] px-6 py-2 text-white">Submit</button>
    </form>
  );
}
