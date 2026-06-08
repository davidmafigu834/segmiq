/**
 * Host-aware sitemap.xml — segmiq.com marketing routes + blog, or cloud.segmiq.com home.
 */

import { getCloudSitemapUrls, getMarketingSitemapEntries, sitemapToXml } from "@/lib/sitemap";

function isCloudHost(host: string): boolean {
  const h = host.split(":")[0];
  return h.startsWith("cloud.");
}

export async function GET(req: Request) {
  const host = req.headers.get("host") ?? "";
  const isCloud = isCloudHost(host);

  const urls = isCloud
    ? getCloudSitemapUrls()
    : (await getMarketingSitemapEntries()).map((e) => e.url);

  const body = sitemapToXml(urls);
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
