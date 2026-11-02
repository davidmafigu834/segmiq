import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPublicListingPage } from "@/lib/real-estate/agent-listing-pages/service";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Property";

export default async function PropertyOpenGraphImage({ params }: { params: { slug: string } }) {
  const loaded = await loadPublicListingPage(createAdminClient(), params.slug, null, {
    userAgent: "facebookexternalhit",
    referrer: null,
    visitor: null,
    recordView: false,
  });
  const ready = loaded.state === "ready" ? (loaded.page as { property: { heading: string; suburb: string | null; statusLabel: string }; agency: { name: string } }) : null;
  const heading = ready?.property.suburb || ready?.property.heading || "Property";
  const agency = ready?.agency.name || "Agency listing";
  const status = ready?.property.statusLabel || "Unavailable";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4efe6", color: "#1c1915", padding: "64px" }}>
        <div style={{ display: "flex", fontSize: 28 }}>{agency}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 2 }}>{status.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 72, lineHeight: 1, maxWidth: 980 }}>{heading}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#5e564c" }}>Powered by SegmiQ</div>
      </div>
    ),
    size
  );
}
