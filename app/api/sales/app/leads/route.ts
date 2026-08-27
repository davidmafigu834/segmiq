import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchLatestFollowUpLogsByLeadId,
  isActiveConvertLaterPick,
} from "@/lib/convert-later-picks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  const supabase = createAdminClient();
  const first = await supabase
    .from("leads")
    .select("*, clients!leads_client_id_fkey ( name, industry, response_time_limit_hours )")
    .eq("assigned_to_id", session!.userId)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false });

  let leads = first.data;
  if (first.error && String(first.error.message || "").includes("column leads.is_archived does not exist")) {
    const retry = await supabase
      .from("leads")
      .select("*, clients!leads_client_id_fkey ( name, industry, response_time_limit_hours )")
      .eq("assigned_to_id", session!.userId)
      .order("created_at", { ascending: false });
    leads = retry.data ?? [];
  }

  if (first.error && !leads) {
    console.error("[sales/app/leads]", first.error);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }

  const leadRows = leads ?? [];
  const pickLeadIds = leadRows.filter(isActiveConvertLaterPick).map((l) => l.id as string);
  const pickLogContext = await fetchLatestFollowUpLogsByLeadId(supabase, pickLeadIds);

  return NextResponse.json({ leads: leadRows, pickLogContext });
}
