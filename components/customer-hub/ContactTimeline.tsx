"use client";

import { useEffect, useState } from "react";
import { TimelineEventList, type TimelineEventRow } from "@/components/leads/TimelineEventList";

export function ContactTimeline({ contactId }: { contactId: string }) {
  const [events, setEvents] = useState<TimelineEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(null);

    fetch(`/api/contacts/${contactId}/timeline`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<{ events: TimelineEventRow[] }>;
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
  }, [contactId]);

  if (error) {
    return <p className="p-6 text-[13px] text-[var(--text-secondary)]">{error}</p>;
  }

  if (events === null) {
    return <p className="p-6 text-[13px] text-[var(--text-tertiary)]">Loading timeline…</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-card)]">
      <TimelineEventList
        events={events}
        emptyMessage="No interactions recorded yet — calls, leads, and messages will appear here."
      />
    </div>
  );
}
