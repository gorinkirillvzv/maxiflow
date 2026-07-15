import type { MetadataRoute } from "next";
import { HELP_ARTICLES } from "@/lib/help/registry";

const BASE = "https://maxiflow.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["/", "/login", "/register", "/help"];
  const helpPages = HELP_ARTICLES.map((a) => `/help/${a.slug}`);
  const now = new Date();
  return [...staticPages, ...helpPages].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path.startsWith("/help") ? ("weekly" as const) : ("monthly" as const),
    priority: path === "/" ? 1.0 : path.startsWith("/help") ? 0.7 : 0.5,
  }));
}
