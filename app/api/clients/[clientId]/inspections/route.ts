import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAcquisitionOpportunities, type AcquisitionActor } from "@/lib/real-estate/acquisition-service";
import { chunk, readAllPages } from "@/lib/real-estate/paging";

export const dynamic = "force-dynamic";

const INSPECTION_CEILING = 5000;

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const actor: AcquisitionActor = {
    id: g.session.userId,
    name: g.session.user?.name ?? "Agent",
    role: g.session.role,
    clientId: g.session.clientId,
  };
  const listed = await listAcquisitionOpportunities({ clientId: params.clientId, actor });
  if (!listed.ok) return NextResponse.json({ error: listed.error }, { status: listed.status });
  const ids = listed.opportunities.map((row) => row.id as string);
  if (!ids.length) return NextResponse.json({ inspections: [], incomplete: listed.incomplete });
  const supabase = createAdminClient();
  const inspections: Record<string, unknown>[] = [];
  let incomplete = listed.incomplete;
  for (const part of chunk(ids, 200)) {
    const page = await readAllPages(
      (from, to) =>
        supabase
          .from("real_estate_inspections")
          .select("*")
          .eq("client_id", params.clientId)
          .in("opportunity_id", part)
          .order("id", { ascending: true })
          .range(from, to),
      { pageSize: 1000, ceiling: INSPECTION_CEILING }
    );
    if (page.error) return NextResponse.json({ error: page.error.message ?? "Could not load inspections." }, { status: 500 });
    if (page.incomplete) incomplete = true;
    inspections.push(...page.rows);
    if (inspections.length >= INSPECTION_CEILING) {
      incomplete = true;
      break;
    }
  }
  inspections.sort((a, b) => String(a.scheduled_at ?? "9999").localeCompare(String(b.scheduled_at ?? "9999")));
  return NextResponse.json({ inspections, incomplete });
}
