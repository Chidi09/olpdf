import type { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Complete API reference, embed SDK guides, and integration docs for OLPDF — the free open-source AI PDF editor. Edit scanned PDFs, extract semantic blocks, export to EPUB3.",
  keywords: [
    "OLPDF docs", "PDF editor API", "embed PDF editor",
    "AI PDF editing API", "open source PDF API", "OLPDF SDK",
  ],
  alternates: { canonical: `${APP_URL}/docs` },
  openGraph: {
    title: "OLPDF Documentation — API, SDK & Guides",
    description:
      "Full API reference and framework integration guides for OLPDF. Covers authentication, document extraction, AI editing, PDF toolkit, and the @olpdf/embed SDK.",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is OLPDF free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. OLPDF is completely free and open source. There are no subscriptions, no upload limits, and no paywalls on the core features.",
      },
    },
    {
      "@type": "Question",
      name: "Can I edit scanned PDFs with OLPDF?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. OLPDF uses Gemini Vision to OCR scanned pages inline — no external GPU worker required. Scanned pages are detected automatically and processed concurrently.",
      },
    },
    {
      "@type": "Question",
      name: "How do I embed OLPDF in my own app?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Install @olpdf/embed via npm and pass a container element, document ID, and token. Framework wrappers are available for React, Svelte, and Vue. Full guides for Astro, Angular, Wix, and WordPress are in the documentation.",
      },
    },
    {
      "@type": "Question",
      name: "What export formats does OLPDF support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "OLPDF exports to standard PDF, PDF/A-1b (archival), Tagged PDF (accessibility / PDF UA), and EPUB3 (for KDP and Apple Books).",
      },
    },
    {
      "@type": "Question",
      name: "Which AI providers does OLPDF support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "OLPDF includes a free Gemini tier with no API key required. Users can bring their own key for Anthropic Claude, OpenAI GPT, DeepSeek, Kimi (Moonshot AI), or a custom Gemini key for higher limits.",
      },
    },
  ],
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  );
}
