/**
 * Host-aware robots.txt — segmiq.com vs cloud.segmiq.com vs blog.segmiq.com.
 */

import { SITE } from "@/lib/seo";

function hostKind(host: string): "cloud" | "blog" | "main" {
  const h = host.split(":")[0];
  if (h.startsWith("cloud.")) return "cloud";
  if (h.startsWith("blog.")) return "blog";
  return "main";
}

export function GET(req: Request) {
  const host = req.headers.get("host") ?? "";
  const kind = hostKind(host);

  if (kind === "cloud") {
    const body = `User-agent: *
Allow: /

Sitemap: ${SITE.cloudUrl}/sitemap.xml
Host: ${SITE.cloudUrl}
`;
    return new Response(body, { headers: { "Content-Type": "text/plain" } });
  }

  if (kind === "blog") {
    const body = `User-agent: *
Allow: /

Sitemap: ${SITE.blogUrl}/sitemap.xml
Host: ${SITE.blogUrl}
`;
    return new Response(body, { headers: { "Content-Type": "text/plain" } });
  }

  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /blog
Disallow: /cloud
Disallow: /admin

Sitemap: ${SITE.url}/sitemap.xml
Host: ${SITE.url}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}
