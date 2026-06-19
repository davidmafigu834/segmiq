/**
 * Blog homepage OpenGraph image at blog.segmiq.com/opengraph-image.
 */

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Segmiq Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function BlogHomeOgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundColor: "#0C0C0C", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#D4FF4F", color: "#000", fontSize: 30, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
          <div style={{ color: "#fff", fontSize: 30, fontWeight: 700 }}>Segmiq</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#D4FF4F", fontSize: 22, fontWeight: 700, letterSpacing: 2, marginBottom: 18, textTransform: "uppercase" }}>BLOG</div>
          <div style={{ color: "#fff", fontSize: 56, fontWeight: 800, lineHeight: 1.12, maxWidth: 960 }}>Ideas on winning trade work in Africa</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 26, marginTop: 20, maxWidth: 860 }}>Specific writing on capturing and closing trade leads.</div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 24 }}>blog.segmiq.com</div>
      </div>
    ),
    { ...size }
  );
}
