import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { getTodaysFocus, getSalesAttentionFlags } from "@/lib/sales/attention";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const flags = getSalesAttentionFlags();
  if (!flags.enabled) {
    return NextResponse.json({ error: "Sales Attention is disabled", code: "DISABLED" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filterRaw = url.searchParams.get("filter")?.toUpperCase() ?? "ALL";
  const filter =
    filterRaw === "IMMEDIATE" ||
    filterRaw === "TODAY" ||
    filterRaw === "NEEDS_PROGRESS" ||
    filterRaw === "WATCH"
      ? filterRaw
      : "ALL";
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const data = await getTodaysFocus({
      userId: session!.userId,
      clientId: session!.clientId,
      filter,
      limit: Number.isFinite(limit) ? limit : undefined,
      enrichTop: url.searchParams.get("enrich") === "1" ? 3 : 0,
    });
    return NextResponse.json({ ...data, flags });
  } catch (err) {
    console.error("Sales attention focus GET error:", err);
    return NextResponse.json(
      {
        error: "Today's Focus couldn't be refreshed. Your CRM records are unchanged.",
        planError: true,
      },
      { status: 500 }
    );
  }
}
