/**
 * Default OpenGraph/Twitter image, rendered on the fly at /opengraph-image.
 * On-brand: near-black background, lime accent. 1200x630.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Segmiq — Revenue operating system for service businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0C0C0C",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#D4FF4F", color: "#000", fontSize: 30, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
          <div style={{ color: "#fff", fontSize: 30, fontWeight: 700 }}>Segmiq</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 70, height: 6, backgroundColor: "#D4FF4F", marginBottom: 28 }} />
          <div style={{ color: "#fff", fontSize: 62, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
            The revenue system for African trade businesses
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 28, marginTop: 22, maxWidth: 860 }}>
            Capture, score, and close every lead — construction, solar, roofing, electrical, landscaping.
          </div>
        </div>

        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 24 }}>segmiq.com</div>
      </div>
    ),
    { ...size }
  );
}
