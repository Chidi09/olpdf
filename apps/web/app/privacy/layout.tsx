import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "OLPDF Privacy Policy — how we handle your data, documents, and personal information.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz"}/privacy` },
  robots: { index: true, follow: false },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
