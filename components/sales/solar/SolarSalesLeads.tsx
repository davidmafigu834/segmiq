"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { SOLAR_SALES_STAGE_LABEL, SOLAR_SALES_STAGES, type SolarSalesStage } from "@/lib/sales/solar-workflow";
import { AddToHubSheet } from "@/components/sales/AddToHubSheet";
import { LeadDetailPanel } from "@/app/sales/leads/LeadDetailPanel";
import { Button } from "@/components/sales/ui";
import { openLeadPanel } from "@/store/uiStore";
import type { LeadRow } from "@/types";

type Card = {
  leadId: string;
  stage: SolarSalesStage;
  customerName: string;
  location: string | null;
  service: string | null;
  nextAction: string;
};

export function SolarSalesLeads({ assignmentMode }: { assignmentMode: "direct" | "pool" | "round_robin" }) {
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<Card[]>([]);
  const [stage, setStage] = useState<SolarSalesStage | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [leads, setLeads] = useState<LeadRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/sales/solar-workflow")
      .then((res) => res.json())
      .then((json: { cards?: Card[]; error?: string }) => {
        if (cancelled) return;
        if (!json.cards) {
          setError(json.error || "Could not load leads.");
          setCards([]);
        } else {
          setCards(json.cards);
          setError(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load leads.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const leadId = searchParams.get("lead");
    if (leadId) void open(leadId);
    // Open the deep link once the page has the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function open(leadId: string) {
    const res = await fetch(`/api/leads/${leadId}`);
    const json = (await res.json().catch(() => ({}))) as { lead?: LeadRow };
    if (!json.lead) return;
    setLeads((current) => [json.lead!, ...current.filter((row) => row.id !== json.lead!.id)]);
    openLeadPanel(leadId);
  }

  const visible = stage === "all" ? cards : cards.filter((card) => card.stage === stage);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[52ch] text-[14px] text-sales-text-secondary">
          Filter by stage. The stage comes from the lead, the visit, the quotation, and the deal.
        </p>
        <Button variant="primary" size="md" leftIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
          Add lead
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Stages">
        <StageChip label="All" count={cards.length} pressed={stage === "all"} onClick={() => setStage("all")} />
        {SOLAR_SALES_STAGES.map((id) => (
          <StageChip
            key={id}
            label={SOLAR_SALES_STAGE_LABEL[id]}
            count={cards.filter((card) => card.stage === id).length}
            pressed={stage === id}
            onClick={() => setStage(id)}
          />
        ))}
      </div>
      {loading ? <div className="h-40 animate-pulse rounded-[12px] bg-sales-surface-subtle" aria-hidden /> : null}
      {error ? <p className="text-[14px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {!loading && !error && visible.length === 0 ? (
        <div className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-8">
          <p className="text-[15px] font-semibold">No leads in this stage</p>
          <p className="mt-1 text-[14px] text-sales-text-secondary">Add a lead, or choose another stage.</p>
        </div>
      ) : null}
      {!loading && visible.length > 0 ? (
        <ul className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          {visible.map((card) => (
            <li key={card.leadId} className="flex items-center gap-3 border-b border-sales-border-subtle px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{card.customerName}</p>
                <p className="truncate text-[12px] text-sales-text-muted">{SOLAR_SALES_STAGE_LABEL[card.stage]}{card.location ? ` · ${card.location}` : ""}</p>
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">{card.nextAction}</p>
              </div>
              <button
                type="button"
                onClick={() => void open(card.leadId)}
                className="inline-flex h-9 shrink-0 items-center rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface"
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {addOpen ? (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            window.location.assign("/sales/leads");
          }}
        />
      ) : null}
      <LeadDetailPanel leads={leads} onLeadUpdated={(lead) => setLeads((current) => current.map((row) => (row.id === lead.id ? lead : row)))} />
    </div>
  );
}

function StageChip({ label, count, pressed, onClick }: { label: string; count: number; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-semibold ${pressed ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border bg-sales-surface text-sales-text-primary"}`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
