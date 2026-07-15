import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/help"],
        disallow: ["/api/", "/dashboard", "/settings", "/audit", "/chat", "/m/"],
      },
    ],
    sitemap: "https://maxiflow.ru/sitemap.xml",
    host: "https://maxiflow.ru",
  };
}
