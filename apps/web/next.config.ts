import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "..", ".."),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "fabric", "@tiptap/core"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      }
    ],
  },
};

let withPWAConfig = (config: NextConfig) => config;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const withPWA = require("next-pwa")({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
  });
  withPWAConfig = withPWA;
} catch {
  withPWAConfig = (config: NextConfig) => config;
}

export default withPWAConfig(nextConfig);
