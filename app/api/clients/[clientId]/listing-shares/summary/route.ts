import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { rangeForPreset } from "@/lib/real-estate/agent-listing-pages/policy";
import { marketingSummary } from "@/lib/real-estate/agent-listing-pages/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  const url = new URL(req.url);
  const preset = url.searchParams.get("preset") ?? "30d";
  if (preset !== "7d" && preset !== "30d" && preset !== "90d" && preset !== "custom") {
    return NextResponse.json({ error: "Invalid range", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const range = rangeForPreset(preset, new Date(), url.searchParams.get("timeZone") || "UTC", url.searchParams.get("from"), url.searchParams.get("to"));
  if (!range) return NextResponse.json({ error: "Invalid range", code: "INVALID_REQUEST" }, { status: 400 });
  const result = await marketingSummary(
    createAdminClient(),
    { userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId, alsoSells: guard.session.alsoSells },
    params.clientId,
    range
  );
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ...result, from: range.from.toISOString(), to: range.to.toISOString(), dayBoundary: "UTC", uniqueVisitors: null }, { headers: { "Cache-Control": "no-store" } });
}
