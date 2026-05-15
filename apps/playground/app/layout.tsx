import { Metadata } from "next";

export const metadata: Metadata = {
  title: "OLPDF Embed Playground",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, height: "100vh" }}>{children}</body>
    </html>
  );
}
