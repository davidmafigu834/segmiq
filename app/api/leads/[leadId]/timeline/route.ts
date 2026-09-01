import { NextResponse } from "next/server";
import { canReadLead } from "@/lib/auth/permissions";
import { buildLeadTimeline } from "@/lib/activity/build-lead-timeline";
import type { ActivityFilterCategory } from "@/lib/activity/types";

export const dynamic = "force-dynamic";

const FILTERS = new Set<ActivityFilterCategory>([
  "all",
  "calls",
  "whatsapp",
  "notes",
  "tasks",
  "documents",
  "quotes",
  "system",
]);

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canReadLead(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = Number(url.searchParams.get("limit") ?? "30");
  const filterRaw = (url.searchParams.get("filter") ?? "all") as ActivityFilterCategory;
  const filter = FILTERS.has(filterRaw) ? filterRaw : "all";
  const search = url.searchParams.get("search");

  const result = await buildLeadTimeline({
    leadId: params.leadId,
    cursor,
    limit: Number.isFinite(limitRaw) ? limitRaw : 30,
    filter,
    search,
  });

  return NextResponse.json(result);
}
