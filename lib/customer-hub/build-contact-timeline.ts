import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactTimelineEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  actor_name: string;
  actor_role: string;
  channel?: string | null;
  created_at: string;
  _source: "lead_events" | "call_logs" | "contact";
};

function dedupeCallTimestamp(iso: string) {
  return new Date(iso).toISOString().slice(0, 19);
}

export async function buildContactTimeline(
  supabase: SupabaseClient,
  contactId: string,
  contactCreatedAt: string,
  contactSource: string | null
): Promise<ContactTimelineEvent[]> {
  const { data: leads } = await supabase
    .from("leads")
    .select("id, project_type, status, source, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });

  const leadIds = (leads ?? []).map((l) => l.id as string);
  const leadMeta = new Map(
    (leads ?? []).map((l) => [
      l.id as string,
      {
        label: (l.project_type as string | null) || humanSource(l.source as string | null) || "Job",
        status: l.status as string,
      },
    ])
  );

  const events: ContactTimelineEvent[] = [
    {
      id: `contact-created-${contactId}`,
      event_type: "CONTACT_CREATED",
      event_data: {
        source: contactSource,
      },
      actor_name: "System",
      actor_role: "SYSTEM",
      created_at: contactCreatedAt,
      _source: "contact",
    },
  ];

  if (leadIds.length) {
    const { data: leadEvents } = await supabase
      .from("lead_events")
      .select("id, lead_id, event_type, event_data, actor_name, actor_role, channel, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: true });

    for (const e of leadEvents ?? []) {
      const meta = leadMeta.get(e.lead_id as string);
      events.push({
        id: e.id as string,
        event_type: e.event_type as string,
        event_data: {
          ...(e.event_data as Record<string, unknown>),
          _lead_label: meta?.label ?? null,
          _lead_id: e.lead_id as string,
        },
        actor_name: (e.actor_name as string) ?? "Unknown",
        actor_role: (e.actor_role as string) ?? "SYSTEM",
        channel: (e.channel as string | null) ?? null,
        created_at: e.created_at as string,
        _source: "lead_events",
      });
    }

    const eventCallTimestamps = new Set(
      events
        .filter((e) => e.event_type === "CALL_LOGGED")
        .map((e) => dedupeCallTimestamp(e.created_at))
    );

    const { data: callLogs } = await supabase
      .from("call_logs")
      .select("id, lead_id, outcome, notes, follow_up_date, created_at, users ( name )")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: true });

    for (const cl of callLogs ?? []) {
      const ts = dedupeCallTimestamp(cl.created_at as string);
      if (eventCallTimestamps.has(ts)) continue;
      const meta = leadMeta.get(cl.lead_id as string);
      events.push({
        id: cl.id as string,
        event_type: "CALL_LOGGED",
        event_data: {
          outcome: cl.outcome,
          notes: cl.notes ?? null,
          follow_up_date: cl.follow_up_date ?? null,
          _lead_label: meta?.label ?? null,
          _lead_id: cl.lead_id as string,
        },
        actor_name: (cl.users as unknown as { name: string } | null)?.name ?? "Unknown",
        actor_role: "SALESPERSON",
        created_at: cl.created_at as string,
        _source: "call_logs",
      });
    }
  }

  return events.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function humanSource(source: string | null): string | null {
  if (!source) return null;
  if (source === "FACEBOOK") return "Facebook lead";
  if (source === "LANDING_PAGE") return "Landing page lead";
  if (source === "REFERRAL") return "Referral";
  if (source === "MANUAL") return "Manual lead";
  return source;
}
