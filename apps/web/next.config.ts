import type { NextConfig } from "next";
import path from "node:path";
import { createRequire } from "node:module";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "..", ".."),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "fabric", "@tiptap/core"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

const _require = createRequire(import.meta.url);
let withPWAConfig = (config: NextConfig) => config;
try {
  const withPWA = _require("next-pwa")({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
  });
  withPWAConfig = withPWA;
} catch {
  // next-pwa optional — skip if not installed
}

export default withPWAConfig(nextConfig);
