import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildObservations } from "@/lib/customer-hub/observations";
import { enrichRecentContacts } from "@/lib/customer-hub/recent-status";
import { getRelationshipCounts } from "@/lib/customer-hub/contact-filters";

export const dynamic = "force-dynamic";

type RpcPayload = {
  pulse: {
    added_today: number;
    followups_due: number;
    quotations_sent_month: number;
    never_contacted: number;
  };
  sources: Array<{
    source: string;
    this_month: number;
    last_month: number;
    followed_up_pct: number;
    quoted_pct: number;
    converted_pct: number;
    health: string;
  }>;
  trend: Array<{ month: number; year: number; count: number; prior_count: number }>;
  recent: Array<{
    id: string;
    name: string;
    initials: string;
    source: string;
    created_at: string;
    salesperson_name: string | null;
    status: string;
  }>;
  observation_meta: {
    walk_in_no_logs: number;
    whatsapp_saved_avg_days: number;
    whatsapp_inbound_avg_hours: number;
    out_of_budget_single: number;
    referral_converted_pct: number;
    facebook_converted_pct: number;
    never_contacted: number;
  };
};

export async function GET() {
  const g = await requireRoles(["CLIENT_MANAGER"]);
  if ("error" in g) return g.error;

  const clientId = g.session.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_customer_hub_stats", {
    p_client_id: clientId,
  });

  if (error) {
    console.error("[customer-hub/stats]", error.message);
    return NextResponse.json({ error: "Could not load dashboard stats" }, { status: 500 });
  }

  const payload = data as RpcPayload;
  const [observations, recent, relationship] = await Promise.all([
    Promise.resolve(buildObservations(payload.observation_meta)),
    enrichRecentContacts(supabase, clientId, payload.recent),
    getRelationshipCounts(supabase, clientId),
  ]);

  return NextResponse.json({
    pulse: payload.pulse,
    sources: payload.sources,
    observations,
    trend: payload.trend,
    recent,
    relationship,
  });
}
