"use client";

import { useEffect, useState } from "react";
import { SOLAR_SALES_STAGES, SOLAR_SALES_STAGE_LABEL } from "@/lib/sales/solar-workflow";
import { useSalesToast } from "@/components/sales/ui";

const PRESETS = [
  { id: "GENERAL_TRADES", label: "General Trades", detail: "Qualified, scoping, proposal sent, and negotiating." },
  { id: "SOLAR_INSTALLATION", label: "Solar Installation", detail: "New lead through site visit, quotation, and close." },
] as const;

export function SalesWorkflowSettings({ clientId }: { clientId: string }) {
  const { toast } = useSalesToast();
  const [preset, setPreset] = useState<string>("GENERAL_TRADES");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/sales/solar-workflow")
      .then((res) => res.json())
      .then((json: { preset?: string }) => {
        if (json.preset) setPreset(json.preset);
      })
      .catch(() => undefined);
  }, [clientId]);

  async function save(next: string) {
    setSaving(true);
    const res = await fetch("/api/sales/solar-workflow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset: next }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; preset?: string };
    setSaving(false);
    if (!res.ok) {
      toast({ title: json.error || "Could not save the workflow.", tone: "error" });
      return;
    }
    setPreset(json.preset || next);
    toast({ title: "Sales workflow updated", tone: "success" });
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-sales-text-primary">Active sales workflow</h2>
        <p className="mt-1 max-w-xl text-[13px] text-sales-text-secondary">
          Solar Installation is a preset. Other trades keep the general pipeline. Existing opportunities are not rewritten.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRESETS.map((item) => {
          const active = preset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={saving}
              onClick={() => void save(item.id)}
              className={`min-h-11 rounded-[12px] border px-4 py-3 text-left ${active ? "border-sales-text-primary bg-sales-surface" : "border-sales-border bg-sales-surface"}`}
            >
              <p className="text-[15px] font-semibold text-sales-text-primary">{item.label}</p>
              <p className="mt-1 text-[13px] text-sales-text-secondary">{item.detail}</p>
              {active ? <p className="mt-2 text-[12px] font-semibold">Active</p> : null}
            </button>
          );
        })}
      </div>
      {preset === "SOLAR_INSTALLATION" ? (
        <ol className="space-y-1 text-[14px] text-sales-text-primary">
          {SOLAR_SALES_STAGES.filter((stage) => stage !== "WON" && stage !== "LOST").map((stage, index) => (
            <li key={stage}>{index + 1}. {SOLAR_SALES_STAGE_LABEL[stage]}</li>
          ))}
          <li>9. Won / Lost</li>
        </ol>
      ) : (
        <ol className="space-y-1 text-[14px] text-sales-text-primary">
          <li>1. Qualified</li>
          <li>2. Scoping</li>
          <li>3. Proposal sent</li>
          <li>4. Negotiating</li>
          <li>5. Won / Lost</li>
        </ol>
      )}
    </section>
  );
}
