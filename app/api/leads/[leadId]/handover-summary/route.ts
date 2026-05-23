import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadLead } from "@/lib/auth/permissions";
import { generateHandoverSummary } from "@/lib/handover-summary";

export async function GET(
  _req: Request,
  { params }: { params: { leadId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // canReadLead takes leadId: string — not the session user object
  const access = await canReadLead(params.leadId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();

  // Check if the most recent LEAD_REASSIGNED event targets the current user within 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentReassignments } = await supabase
    .from("lead_events")
    .select("event_data, created_at")
    .eq("lead_id", params.leadId)
    .eq("event_type", "LEAD_REASSIGNED")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastReassignment = recentReassignments?.[0] ?? null;
  const eventData = (lastReassignment?.event_data as Record<string, unknown> | null) ?? null;
  const isRecentlyReassigned = eventData?.to_id === session.userId;

  if (!isRecentlyReassigned) {
    return NextResponse.json({ isRecentlyReassigned: false, summary: null });
  }

  const summary = await generateHandoverSummary(params.leadId);
  return NextResponse.json({ isRecentlyReassigned: true, summary });
}
