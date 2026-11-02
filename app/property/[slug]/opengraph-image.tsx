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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f7f4ef", color: "#171916", padding: "72px" }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 1 }}>{agency}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 3 }}>{status.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 68, lineHeight: 1.02, maxWidth: 980 }}>{heading}</div>
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "#5c6158" }}>Property information · not a photograph</div>
      </div>
    ),
    size
  );
}
