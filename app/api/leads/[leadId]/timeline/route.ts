import { NextResponse } from "next/server";
import { canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { leadId: string } }) {
  const access = await canReadLead(params.leadId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();

  // Fetch lead_events (structured events)
  const { data: events, error: eventsError } = await supabase
    .from("lead_events")
    .select("id, event_type, event_data, actor_name, actor_role, created_at")
    .eq("lead_id", params.leadId)
    .order("created_at", { ascending: true });

  if (eventsError) {
    console.error("[timeline] lead_events fetch failed", eventsError);
  }

  // Fetch legacy call_logs — included for backward compatibility with leads
  // that pre-date the lead_events table
  const { data: callLogs, error: callLogsError } = await supabase
    .from("call_logs")
    .select("id, outcome, notes, follow_up_date, created_at, users ( name )")
    .eq("lead_id", params.leadId)
    .order("created_at", { ascending: true });

  if (callLogsError) {
    console.error("[timeline] call_logs fetch failed", callLogsError);
  }

  // Normalise call logs into the same shape as timeline events.
  // We deduplicate by checking if a CALL_LOGGED event with the same
  // timestamp already exists (from the new event logging system).
  const eventCallTimestamps = new Set(
    (events ?? [])
      .filter((e) => e.event_type === "CALL_LOGGED")
      .map((e) => {
        // Round to nearest second for dedup — DB timestamps may differ by ms
        return new Date(e.created_at as string).toISOString().slice(0, 19);
      })
  );

  type NormalisedCallLog = {
    id: string;
    event_type: "CALL_LOGGED";
    event_data: Record<string, unknown>;
    actor_name: string;
    actor_role: string;
    created_at: string;
    _source: "call_logs";
  };

  const legacyCallEvents: NormalisedCallLog[] = (callLogs ?? [])
    .filter((cl) => {
      const ts = new Date(cl.created_at as string).toISOString().slice(0, 19);
      return !eventCallTimestamps.has(ts);
    })
    .map((cl) => ({
      id: cl.id as string,
      event_type: "CALL_LOGGED" as const,
      event_data: {
        outcome: cl.outcome,
        notes: cl.notes ?? null,
        follow_up_date: cl.follow_up_date ?? null,
      },
      actor_name:
        (cl.users as unknown as { name: string } | null)?.name ?? "Unknown",
      actor_role: "SALESPERSON",
      created_at: cl.created_at as string,
      _source: "call_logs" as const,
    }));

  // Merge and sort chronologically
  const allEvents = [
    ...(events ?? []).map((e) => ({ ...e, _source: "lead_events" as const })),
    ...legacyCallEvents,
  ].sort(
    (a, b) =>
      new Date(a.created_at as string).getTime() -
      new Date(b.created_at as string).getTime()
  );

  return NextResponse.json({ events: allEvents });
}
