/**
 * Per-post OpenGraph image at blog.segmiq.com/<slug>/opengraph-image.
 */

import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/blog";

export const alt = "Segmiq blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function BlogOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const title = post?.title ?? "Segmiq Blog";
  const category = post?.categoryLabel ?? "BLOG";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundColor: "#0C0C0C", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#D4FF4F", color: "#000", fontSize: 26, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>Segmiq Blog</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#D4FF4F", fontSize: 22, fontWeight: 700, letterSpacing: 2, marginBottom: 18, textTransform: "uppercase" }}>{category}</div>
          <div style={{ color: "#fff", fontSize: 56, fontWeight: 800, lineHeight: 1.12, maxWidth: 960 }}>{title}</div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 24 }}>blog.segmiq.com</div>
      </div>
    ),
    { ...size }
  );
}
