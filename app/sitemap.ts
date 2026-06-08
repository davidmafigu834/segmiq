import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://segmiq.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllSlugs();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/features`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/products/segmiq-crm`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/solutions/construction`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/solutions/solar`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/solutions/roofing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/solutions/electrical-landscaping`, changeFrequency: "monthly", priority: 0.7 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/blog/${slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...blogRoutes];
}
