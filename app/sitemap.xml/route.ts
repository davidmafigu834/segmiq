/**
 * Host-aware sitemap.xml — segmiq.com marketing routes, blog.segmiq.com, or cloud.segmiq.com.
 */

import { getBlogSitemapUrls, getCloudSitemapUrls, getMarketingSitemapEntries, sitemapToXml } from "@/lib/sitemap";

function hostKind(host: string): "cloud" | "blog" | "main" {
  const h = host.split(":")[0];
  if (h.startsWith("cloud.")) return "cloud";
  if (h.startsWith("blog.")) return "blog";
  return "main";
}

export async function GET(req: Request) {
  const host = req.headers.get("host") ?? "";
  const kind = hostKind(host);

  const urls =
    kind === "cloud"
      ? getCloudSitemapUrls()
      : kind === "blog"
        ? await getBlogSitemapUrls()
        : (await getMarketingSitemapEntries()).map((e) => e.url);

  const body = sitemapToXml(urls);
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
