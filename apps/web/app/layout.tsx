import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import LayoutShell from "@/components/LayoutShell";
import { DEFAULT_BRAND } from "@/lib/branding";
import { TypekitLoader } from "@/components/TypekitLoader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "OLPDF — Word for PDFs",
    template: "%s | OLPDF",
  },
  description:
    "OLPDF is a free, AI-powered PDF editor that reconstructs semantic layouts from raw coordinates — edit PDFs like a Word document. No uploads, no subscriptions.",
  keywords: [
    "PDF editor",
    "AI PDF editor",
    "edit scanned PDF online free",
    "edit PDF like Word document",
    "open source PDF editor",
    "AI document editor",
    "PDF to semantic HTML",
    "free PDF AI editor",
    "PDF block editor",
    "EPUB3 export from PDF",
    "PDF text extraction AI",
    "OLPDF",
  ],
  authors: [{ name: "OLPDF" }],
  creator: "OLPDF",
  publisher: "OLPDF",
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "OLPDF",
    title: "OLPDF — Word for PDFs",
    description:
      "Edit PDFs like a Word document. Free AI-powered PDF editor with semantic structure reconstruction.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OLPDF — Word for PDFs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@olpdfxyz",
    creator: "@olpdfxyz",
    title: "OLPDF — Word for PDFs",
    description:
      "Edit PDFs like a Word document. Free AI-powered PDF editor with semantic structure reconstruction.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: DEFAULT_BRAND.favicon },
      { url: DEFAULT_BRAND.icon192, sizes: "192x192", type: "image/png" },
      { url: DEFAULT_BRAND.icon512, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: DEFAULT_BRAND.icon192 }],
  },
  alternates: {
    canonical: APP_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Preconnect hints — reduce DNS/TLS overhead for external assets */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://p.typekit.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.simpleicons.org" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col">
        {/* SVG filter — referenced by .liquid-glass::before via filter:url(#lg-distort) */}
        <svg aria-hidden="true" style={{ display: "none", position: "absolute" }}>
          <defs>
            <filter id="lg-distort" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.022 0.014" numOctaves="4" seed="9" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <TypekitLoader />
        <Providers>
          <LayoutShell>{children}</LayoutShell>
        </Providers>
      </body>
    </html>
  );
}
