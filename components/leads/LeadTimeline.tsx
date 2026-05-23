"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";

type TimelineEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  actor_name: string;
  actor_role: string;
  created_at: string;
  _source: "lead_events" | "call_logs";
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: "bg-[var(--status-new-bg)] text-[var(--status-new-fg)]",
    CONTACTED: "bg-[var(--status-contacted-bg)] text-[var(--status-contacted-fg)]",
    NEGOTIATING: "bg-[var(--status-negotiating-bg)] text-[var(--status-negotiating-fg)]",
    PROPOSAL_SENT: "bg-[var(--status-proposal-bg)] text-[var(--status-proposal-fg)]",
    WON: "bg-[var(--status-won-bg)] text-[var(--status-won-fg)]",
    LOST: "bg-[var(--status-lost-bg)] text-[var(--status-lost-fg)]",
    NOT_QUALIFIED: "bg-[var(--status-not-qualified-bg)] text-[var(--status-not-qualified-fg)]",
  };
  const cls = map[status] ?? "bg-surface-card-alt text-ink-secondary";
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-flex h-5 items-center rounded-sm px-2 font-mono text-[10px] font-medium uppercase leading-none ${cls}`}>
      {label}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const label = outcome.replace(/_/g, " ");
  if (outcome === "WON") {
    return (
      <span className="inline-flex h-5 items-center rounded-sm bg-[var(--status-won-bg)] px-2 font-mono text-[10px] font-medium uppercase leading-none text-[var(--status-won-fg)]">
        {label}
      </span>
    );
  }
  if (outcome === "LOST") {
    return (
      <span className="inline-flex h-5 items-center rounded-sm bg-[var(--status-lost-bg)] px-2 font-mono text-[10px] font-medium uppercase leading-none text-[var(--status-lost-fg)]">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center rounded-sm bg-surface-card-alt px-2 font-mono text-[10px] uppercase leading-none text-ink-secondary">
      {label}
    </span>
  );
}

function dotColor(eventType: string, outcome?: string): string {
  if (eventType === "CALL_LOGGED") {
    if (outcome === "WON") return "bg-[var(--status-won-fg)]";
    if (outcome === "LOST") return "bg-[var(--status-lost-fg)]";
    return "bg-ink-tertiary";
  }
  if (eventType === "LEAD_CREATED") return "bg-[var(--info)]";
  if (eventType === "STATUS_CHANGED") return "bg-ink-secondary";
  if (eventType === "LEAD_REASSIGNED" || eventType === "LEAD_ASSIGNED") return "bg-ink-secondary";
  if (eventType === "FOLLOW_UP_SET") return "bg-ink-tertiary";
  return "bg-ink-tertiary";
}

function EventContent({ event }: { event: TimelineEvent }) {
  const d = event.event_data;

  if (event.event_type === "LEAD_CREATED") {
    const source = (d.source as string | null) ?? "Unknown";
    const assignedTo = d.assigned_to_name as string | null;
    const summary = d.form_data_summary as string | null;
    return (
      <div>
        <p className="text-[13px] text-ink-primary">
          Lead created via{" "}
          <span className="font-mono text-[11px] text-ink-secondary">{source.replace(/_/g, " ")}</span>
        </p>
        {assignedTo ? (
          <p className="mt-0.5 text-[12px] text-ink-secondary">Assigned to {assignedTo}</p>
        ) : (
          <p className="mt-0.5 text-[12px] text-ink-tertiary">Unassigned</p>
        )}
        {summary ? <p className="mt-0.5 text-[12px] text-ink-tertiary">{summary}</p> : null}
      </div>
    );
  }

  if (event.event_type === "STATUS_CHANGED") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={d.from_status as string} />
        <span className="text-[11px] text-ink-tertiary">→</span>
        <StatusBadge status={d.to_status as string} />
      </div>
    );
  }

  if (event.event_type === "LEAD_ASSIGNED") {
    return (
      <p className="text-[13px] text-ink-primary">
        Assigned to <span className="font-medium">{(d.assigned_to_name as string) || "—"}</span>
      </p>
    );
  }

  if (event.event_type === "LEAD_REASSIGNED") {
    const fromName = (d.from_name as string) || "Unassigned";
    const toName = (d.to_name as string) || "Unassigned";
    const notes = d.handover_notes as string | null;
    return (
      <div>
        <p className="text-[13px] text-ink-primary">
          Reassigned from{" "}
          <span className="font-medium">{fromName}</span>{" "}
          to{" "}
          <span className="font-medium">{toName}</span>
        </p>
        {notes ? (
          <p className="mt-1 rounded bg-surface-card-alt px-2 py-1.5 text-[12px] text-ink-secondary">
            {notes}
          </p>
        ) : null}
      </div>
    );
  }

  if (event.event_type === "CALL_LOGGED") {
    const outcome = (d.outcome as string) || "";
    const notes = d.notes as string | null;
    const followUp = d.follow_up_date as string | null;
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
            Call
          </span>
          <OutcomeBadge outcome={outcome} />
        </div>
        {notes ? <p className="mt-1 text-[13px] text-ink-primary">{notes}</p> : null}
        {followUp ? (
          <p className="mt-0.5 text-[11px] text-ink-tertiary">
            Follow-up: {format(parseISO(followUp), "MMM d, yyyy")}
          </p>
        ) : null}
      </div>
    );
  }

  if (event.event_type === "FOLLOW_UP_SET") {
    const date = d.follow_up_date as string | null;
    const notes = d.notes as string | null;
    return (
      <div>
        <p className="text-[13px] text-ink-primary">
          Follow-up set{date ? ` for ${format(parseISO(date), "MMM d, yyyy")}` : ""}
        </p>
        {notes ? <p className="mt-0.5 text-[12px] text-ink-secondary">{notes}</p> : null}
      </div>
    );
  }

  if (event.event_type === "DOCUMENT_SENT") {
    const name = d.document_name as string | null;
    const type = d.document_type as string | null;
    return (
      <p className="text-[13px] text-ink-primary">
        Document sent{type ? ` (${type})` : ""}{name ? `: ${name}` : ""}
      </p>
    );
  }

  return (
    <p className="font-mono text-[11px] uppercase text-ink-secondary">
      {event.event_type.replace(/_/g, " ")}
    </p>
  );
}

export function LeadTimeline({ leadId }: { leadId: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(null);

    fetch(`/api/leads/${leadId}/timeline`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<{ events: TimelineEvent[] }>;
      })
      .then((data) => {
        if (!cancelled) setEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load timeline.");
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (error) {
    return <p className="p-4 text-[13px] text-ink-secondary">{error}</p>;
  }

  if (events === null) {
    return <p className="p-4 text-[13px] text-ink-tertiary">Loading…</p>;
  }

  if (events.length === 0) {
    return <p className="p-4 text-[13px] text-ink-tertiary">No events recorded yet.</p>;
  }

  return (
    <div className="px-4 py-3 sm:px-5">
      <ul className="relative list-none space-y-0 p-0">
        <div className="absolute bottom-0 left-[7px] top-2 border-l border-border" aria-hidden />
        {events.map((event) => {
          const outcome = event.event_data.outcome as string | undefined;
          const ts = parseISO(event.created_at as string);
          return (
            <li key={event.id} className="relative border-b border-border py-3.5 pl-6 last:border-b-0">
              <span
                className={`absolute left-[3px] top-[18px] flex h-[9px] w-[9px] items-center justify-center rounded-full border border-surface-card ${dotColor(event.event_type, outcome)}`}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3">
                <EventContent event={event} />
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-mono text-[11px] text-ink-tertiary tabular-nums">
                    {format(ts, "HH:mm")}
                  </span>
                  <span className="font-mono text-[10px] text-ink-tertiary tabular-nums">
                    {format(ts, "MMM d")}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-ink-tertiary">
                {event.actor_name}
                {event.actor_role && event.actor_role !== "SYSTEM"
                  ? ` · ${event.actor_role.replace(/_/g, " ")}`
                  : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
