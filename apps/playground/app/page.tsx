"use client";

import { useEffect, useRef } from "react";
import { OlPDFEmbed } from "@olpdf/embed";

export default function PlaygroundPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  const host = process.env.NEXT_PUBLIC_OLPDF_HOST || "http://localhost:3000";
  const documentId = process.env.NEXT_PUBLIC_OLPDF_DOCUMENT_ID || "doc_demo";
  const token = process.env.NEXT_PUBLIC_OLPDF_TOKEN || "demo-token";

  useEffect(() => {
    if (!containerRef.current) return;
    const editor = new OlPDFEmbed(containerRef.current, { host, documentId, token });

    editor.on("event:ready", () => console.log("[playground] editor ready"));
    editor.on<{ documentModel: unknown }>("event:modelUpdate", ({ documentModel }) => console.log("[playground] model updated", documentModel));

    return () => editor.destroy();
  }, [host, documentId, token]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: "8px 16px", borderBottom: "1px solid #e5e7eb", fontSize: 14, background: "#f9fafb" }}>
        OLPDF Embed Playground — <code style={{ fontSize: 12 }}>{documentId}</code>
      </header>
      <div ref={containerRef} style={{ flex: 1, overflow: "hidden" }} />
    </div>
  );
}
