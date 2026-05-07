import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contribute",
  description:
    "Contribute to OLPDF — the open-source AI PDF editor. Help build the future of document editing by contributing code, templates, or feedback.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz"}/contribute` },
  openGraph: {
    title: "Contribute to OLPDF",
    description: "Help build the future of PDF editing. Contribute code, templates, or feedback to OLPDF.",
  },
};

export default function ContributeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
