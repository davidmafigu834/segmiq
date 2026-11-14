import { ImageResponse } from "next/og";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { funnelActor } from "@/lib/real-estate/funnels/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 9:16 WhatsApp Status image for one property, carrying the agent's name. */
export async function GET(req: Request, { params }: { params: { listingId: string } }) {
  const actor = await funnelActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!z.string().uuid().safeParse(params.listingId).success) return new Response("Not found", { status: 404 });
  const db = createAdminClient();
  const [{ data: listing }, { data: funnel }, { data: user }, { data: client }] = await Promise.all([
    db.from("listings").select("address, suburb").eq("client_id", actor.clientId!).eq("id", params.listingId).maybeSingle(),
    db.from("re_listing_funnels").select("share_image_url, price_label, status").eq("listing_id", params.listingId).maybeSingle(),
    db.from("users").select("name").eq("id", actor.userId).maybeSingle(),
    db.from("clients").select("name").eq("id", actor.clientId!).maybeSingle(),
  ]);
  if (!listing) return new Response("Not found", { status: 404 });
  const row = listing as { address?: string | null; suburb?: string | null };
  const meta = (funnel ?? {}) as { share_image_url?: string | null; price_label?: string | null };
  const origin = new URL(req.url).origin;
  const photo = meta.share_image_url ? (meta.share_image_url.startsWith("/") ? `${origin}${meta.share_image_url}` : meta.share_image_url) : null;
  const name = (user as { name?: string } | null)?.name?.trim() || "Your agent";
  const first = name.split(/\s+/)[0];
  const agency = (client as { name?: string } | null)?.name?.trim() || "";
  const heading = row.address?.trim() || row.suburb?.trim() || "Property";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#101418", color: "#fff", fontFamily: "sans-serif" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={1080} height={1920} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(180deg, rgba(10,14,20,0.15) 0%, rgba(10,14,20,0.1) 40%, rgba(10,14,20,0.92) 78%)" }} />
        <div style={{ position: "absolute", top: 80, left: 80, right: 80, display: "flex", fontSize: 34, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>{agency}</div>
        <div style={{ position: "absolute", left: 80, right: 80, bottom: 120, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignSelf: "flex-start", padding: "10px 22px", borderRadius: 999, background: "#fff", color: "#101418", fontSize: 30, fontWeight: 700 }}>For sale</div>
          <div style={{ display: "flex", marginTop: 36, fontSize: 104, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>{heading}</div>
          {meta.price_label ? <div style={{ display: "flex", marginTop: 24, fontSize: 64, fontWeight: 600 }}>{meta.price_label}</div> : null}
          {row.suburb && row.suburb !== heading ? <div style={{ display: "flex", marginTop: 16, fontSize: 38, opacity: 0.85 }}>{row.suburb}</div> : null}
          <div style={{ display: "flex", alignItems: "center", marginTop: 64, padding: "22px 28px", borderRadius: 20, background: "rgba(255,255,255,0.14)", fontSize: 38, fontWeight: 600 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 76, height: 76, borderRadius: 999, background: "#fff", color: "#101418", fontSize: 32, fontWeight: 700, marginRight: 24 }}>{initials}</div>
            Message {first} for the details
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${heading.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "property"}-status.png"`,
      },
    }
  );
}
