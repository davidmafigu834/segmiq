/**
 * Shared sitemap URL builders for host-aware /sitemap.xml route.
 */

import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { getPublishedPosts } from "@/lib/blog";

const STATIC_PATHS: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, freq: "weekly" },
  { path: "/why-segmiq", priority: 0.8, freq: "monthly" },
  { path: "/security", priority: 0.6, freq: "monthly" },
  { path: "/products/segmiq-crm", priority: 0.9, freq: "monthly" },
  { path: "/pricing", priority: 0.9, freq: "monthly" },
  { path: "/features", priority: 0.8, freq: "monthly" },
  { path: "/solutions/construction", priority: 0.8, freq: "monthly" },
  { path: "/solutions/solar", priority: 0.8, freq: "monthly" },
  { path: "/solutions/roofing", priority: 0.8, freq: "monthly" },
  { path: "/solutions/electrical-landscaping", priority: 0.8, freq: "monthly" },
  { path: "/contact", priority: 0.7, freq: "yearly" },
  { path: "/partners", priority: 0.6, freq: "yearly" },
  { path: "/careers", priority: 0.5, freq: "weekly" },
  { path: "/privacy", priority: 0.3, freq: "yearly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
  { path: "/status", priority: 0.3, freq: "daily" },
];

export async function getMarketingSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  return STATIC_PATHS.map((p) => ({
    url: new URL(p.path, SITE.url).toString(),
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}

export async function getBlogSitemapUrls(): Promise<string[]> {
  const urls = [`${SITE.blogUrl}/`];
  try {
    const posts = await getPublishedPosts();
    for (const post of posts) {
      urls.push(`${SITE.blogUrl}/${post.slug}`);
    }
  } catch {
    /* ship home URL only if data source is unreachable */
  }
  return urls;
}

export function getCloudSitemapUrls(): string[] {
  return [`${SITE.cloudUrl}/`];
}

export function sitemapToXml(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
}
