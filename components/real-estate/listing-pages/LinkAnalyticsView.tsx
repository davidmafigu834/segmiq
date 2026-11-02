"use client";

import { useEffect, useState } from "react";

type Payload = {
  totals?: { visits: number; uniqueVisitors: number | null; enquiries: number; viewingRequests: number; whatsappClicks: number; confirmedWhatsappLeads: number; engagedViews: number; previewFetches: number };
  series?: Array<{ day: string; visits: number }>;
  insights?: string[];
  outcomeNote?: string | null;
  error?: string;
};

export function LinkAnalyticsView({ clientId, shareId }: { clientId: string; shareId: string }) {
  const [preset, setPreset] = useState("30d");
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    void fetch(`/api/clients/${clientId}/listing-shares/${shareId}/analytics?preset=${preset}`)
      .then((response) => response.json())
      .then((json: Payload) => setData(json));
  }, [clientId, shareId, preset]);

  const totals = data?.totals;
  const max = Math.max(1, ...(data?.series ?? []).map((point) => point.visits));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["7d", "30d", "90d"].map((value) => (
          <button key={value} type="button" className="h-9 rounded-[10px] border border-sales-border px-3 text-[13px]" onClick={() => setPreset(value)}>{value}</button>
        ))}
      </div>
      {data?.error ? <p className="text-[13px]">{data.error}</p> : null}
      {!totals || totals.visits === 0 ? <p className="text-[13px] text-sales-text-secondary">No human visits in this period. Preview fetches from WhatsApp or Facebook are kept separate{totals ? ` (${totals.previewFetches}).` : "."}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Visits" value={totals?.visits ?? 0} />
        <Stat label="Estimated unique visitors" value={totals?.uniqueVisitors ?? "—"} />
        <Stat label="Enquiries" value={totals?.enquiries ?? 0} />
        <Stat label="Viewing requests" value={totals?.viewingRequests ?? 0} />
        <Stat label="WhatsApp taps" value={totals?.whatsappClicks ?? 0} />
        <Stat label="Confirmed WhatsApp leads" value={totals?.confirmedWhatsappLeads ?? 0} />
      </div>
      <div className="flex h-32 items-end gap-1 rounded-[14px] border border-sales-border bg-sales-surface p-3" aria-label="Visits over time">
        {(data?.series ?? []).map((point) => (
          <span key={point.day} title={`${point.day}: ${point.visits}`} className="flex-1 rounded-t bg-sales-brand" style={{ height: `${Math.max(4, (point.visits / max) * 100)}%` }} />
        ))}
      </div>
      {(data?.insights ?? []).map((line) => <p key={line} className="text-[13px] text-sales-text-secondary">{line}</p>)}
      {data?.outcomeNote ? <p className="text-[13px] text-sales-text-secondary">{data.outcomeNote}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-[14px] border border-sales-border bg-sales-surface p-4"><p className="text-[12px] text-sales-text-muted">{label}</p><p className="mt-1 text-[22px] font-semibold tabular-nums">{value}</p></div>;
}
