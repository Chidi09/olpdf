import type { MetadataRoute } from "next";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz").trim();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: APP_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${APP_URL}/docs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/help`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/marketplace`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/contribute`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${APP_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${APP_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${APP_URL}/security`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
