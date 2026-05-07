import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security",
  description:
    "OLPDF Security — how we protect your documents, data, and account. Responsible disclosure and security practices.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz"}/security` },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
