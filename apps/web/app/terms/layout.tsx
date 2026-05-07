import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "OLPDF Terms of Service — the rules and agreements for using our free AI PDF editor.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz"}/terms` },
  robots: { index: true, follow: false },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
