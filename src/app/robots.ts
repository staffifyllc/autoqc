import type { MetadataRoute } from "next";

const SITE_URL = "https://www.autoqc.io";

// Tells search engine crawlers what they can and can't index.
// Private / user-specific routes are disallowed so they never show up
// in Google results. Public marketing pages stay open.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/login",
          "/onboarding",
          "/_next/",
          "/static/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
