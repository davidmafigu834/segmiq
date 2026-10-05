"use client";

import { useEffect, useState } from "react";
import { AskSegmiq } from "@/components/intelligence/AskSegmiq";

type Attention = { title: string; detail: string };
type ActionRow = { id: string; tool_name: string; risk_level: string; result_summary: string | null; status: string; approval_required: boolean };

export function IntelligenceHome() {
  const [attention, setAttention] = useState<Attention[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [requestsToday, setRequestsToday] = useState(0);

  useEffect(() => {
    void fetch("/api/intelligence/center")
      .then((res) => res.json())
      .then((data: { attention?: Attention[]; actions?: ActionRow[]; requestsToday?: number }) => {
        setAttention(data.attention ?? []);
        setActions(data.actions ?? []);
        setRequestsToday(data.requestsToday ?? 0);
      })
      .catch(() => undefined);
  }, []);

  const waiting = actions.filter((row) => row.status === "PENDING");

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">SegmiQ Intelligence</h1>
          <p className="mt-2 text-sm text-sales-text-secondary">Answers come from live records. Consequential changes wait for your approval.</p>
        </div>
        <AskSegmiq />
      </div>
      <aside className="space-y-4">
        <section className="rounded-sales-md border border-sales-border p-3">
          <h2 className="text-[13px] font-semibold">Needs attention</h2>
          <ul className="mt-2 space-y-2 text-[13px] leading-5">
            {attention.length ? attention.slice(0, 8).map((item) => (
              <li key={`${item.title}-${item.detail}`}><span className="font-medium">{item.title}</span> — {item.detail}</li>
            )) : <li className="text-sales-text-secondary">No attention items from the current checks.</li>}
          </ul>
        </section>
        <section className="rounded-sales-md border border-sales-border p-3">
          <h2 className="text-[13px] font-semibold">Drafts awaiting approval</h2>
          <ul className="mt-2 space-y-2 text-[13px]">
            {waiting.length ? waiting.map((row) => <li key={row.id}>{row.result_summary}</li>) : <li className="text-sales-text-secondary">None waiting.</li>}
          </ul>
        </section>
        <section className="rounded-sales-md border border-sales-border p-3">
          <h2 className="text-[13px] font-semibold">Recent AI actions</h2>
          <p className="mt-1 text-[12px] text-sales-text-secondary">{requestsToday} requests today</p>
          <ul className="mt-2 space-y-2 text-[13px]">
            {actions.slice(0, 6).map((row) => (
              <li key={row.id}><span className="font-medium">{row.tool_name}</span> · {row.status}</li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
