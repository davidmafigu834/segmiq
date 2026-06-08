/**
 * Host-aware robots.txt — segmiq.com vs cloud.segmiq.com.
 */

import { SITE } from "@/lib/seo";

function isCloudHost(host: string): boolean {
  const h = host.split(":")[0];
  return h.startsWith("cloud.");
}

export function GET(req: Request) {
  const host = req.headers.get("host") ?? "";
  const isCloud = isCloudHost(host);

  if (isCloud) {
    const body = `User-agent: *
Allow: /

Sitemap: ${SITE.cloudUrl}/sitemap.xml
Host: ${SITE.cloudUrl}
`;
    return new Response(body, { headers: { "Content-Type": "text/plain" } });
  }

  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /cloud
Disallow: /admin

Sitemap: ${SITE.url}/sitemap.xml
Host: ${SITE.url}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}
