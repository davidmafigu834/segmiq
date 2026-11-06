import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRealEstate } from "@/lib/terminology";
import { loadRealEstateCalendarViewings } from "@/lib/real-estate/viewing-calendar-load";

export const dynamic = "force-dynamic";

const MAX_WINDOW_MS = 100 * 24 * 60 * 60 * 1000;

/** Windowed viewing events for the web calendar. Does not change the viewing list contract. */
export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  const session = guard.session;
  if (!["SALESPERSON", "CLIENT_MANAGER", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const fromIso = url.searchParams.get("from") ?? "";
  const toIsoExclusive = url.searchParams.get("to") ?? "";
  const surface = url.searchParams.get("surface") === "client" ? "client" : "sales";
  if (surface === "client" && session.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIsoExclusive);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs || toMs - fromMs > MAX_WINDOW_MS) {
    return NextResponse.json({ error: "Use a from/to window of at most 100 days.", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", params.clientId).maybeSingle();
  if (!isRealEstate(client?.business_type)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const timezone = url.searchParams.get("timezone") || "UTC";
  const loaded = await loadRealEstateCalendarViewings({
    requestHeaders: req.headers,
    clientId: params.clientId,
    actor: { userId: session.userId, role: session.role, clientId: session.clientId },
    surface,
    timezone,
    fromIso,
    toIsoExclusive,
  });
  if (loaded.failed) {
    return NextResponse.json(
      { failed: true, incomplete: false, events: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    {
      failed: false,
      incomplete: loaded.incomplete,
      events: surface === "client" ? loaded.companyEvents : loaded.salesEvents,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
