import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Get help with OLPDF. Find answers about PDF editing, AI features, account settings, and more.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz"}/help` },
  openGraph: {
    title: "OLPDF Help Center",
    description: "Find answers and support for using OLPDF — the free AI PDF editor.",
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
