import type { MetadataRoute } from "next";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz").trim();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs", "/help", "/privacy", "/terms", "/security", "/contribute", "/marketplace"],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/editor",
          "/books",
          "/templates",
          "/toolkit",
          "/settings",
          "/analytics",
          "/favorites",
          "/onboarding",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
