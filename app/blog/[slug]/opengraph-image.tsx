/**
 * Per-post OpenGraph image at blog.segmiq.com/<slug>/opengraph-image.
 */

import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/blog";
import { getOgMarkDataUrl } from "@/lib/og-brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Segmiq Wire story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function BlogOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const title = post?.title ?? "Segmiq Wire";
  const category = post?.categoryLabel ?? "BLOG";
  const mark = await getOgMarkDataUrl();

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundColor: "#0C0C0C", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={48} height={48} alt="" style={{ borderRadius: 12 }} />
          <div style={{ color: "#fff", fontSize: 30, fontWeight: 700 }}>Segmiq</div>
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
