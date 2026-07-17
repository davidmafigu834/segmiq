"use client";

import { useEffect, useState } from "react";
import { TimelineEventList, type TimelineEventRow } from "@/components/leads/TimelineEventList";

export function LeadTimeline({ leadId }: { leadId: string }) {
  const [events, setEvents] = useState<TimelineEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(null);

    fetch(`/api/leads/${leadId}/timeline`)
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
  }, [leadId]);

  if (error) {
    return <p className="p-4 text-[13px] text-ink-secondary">{error}</p>;
  }

  if (events === null) {
    return <p className="p-4 text-[13px] text-ink-tertiary">Loading…</p>;
  }

  return <TimelineEventList events={events} />;
}
