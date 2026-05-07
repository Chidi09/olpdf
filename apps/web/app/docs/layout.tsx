import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Learn how to use OLPDF — the free AI-powered PDF editor. Guides on semantic editing, AI rewriting, book management, templates, and toolkit features.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz"}/docs` },
  openGraph: {
    title: "OLPDF Documentation",
    description: "Guides and references for editing PDFs like a Word document with OLPDF.",
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
