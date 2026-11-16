"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SOLAR_SALES_STAGE_LABEL, SOLAR_SALES_STAGES, type SolarSalesStage } from "@/lib/sales/solar-workflow";
import { SolarCreateSheet } from "@/components/sales/solar/SolarCreateSheet";
import { LeadDetailPanel } from "@/app/sales/leads/LeadDetailPanel";
import { openLeadPanel } from "@/store/uiStore";
import type { LeadRow } from "@/types";
import { Bones, EmptyNote, Head, Panel, WorkRow, inkBtn, lineBtn } from "./desk";

type Card = {
  leadId: string;
  stage: SolarSalesStage;
  customerName: string;
  location: string | null;
  service: string | null;
  nextAction: string;
};

export function SolarSalesLeads() {
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
    if (searchParams.get("add") === "1") setAddOpen(true);
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
    <div className="space-y-8">
      <Head
        kicker="Sales"
        title="Leads"
        detail="New, contacted, and qualified stay on those stages until a visit or a quotation exists."
        action="New lead"
        onAction={() => setAddOpen(true)}
      />
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Stages">
        <button type="button" className={stage === "all" ? inkBtn : lineBtn} aria-pressed={stage === "all"} onClick={() => setStage("all")}>All</button>
        {SOLAR_SALES_STAGES.map((id) => (
          <button key={id} type="button" className={stage === id ? inkBtn : lineBtn} aria-pressed={stage === id} onClick={() => setStage(id)}>
            {SOLAR_SALES_STAGE_LABEL[id]}
          </button>
        ))}
      </div>
      {error ? <p className="text-[14px] text-sales-danger-fg" role="alert">{error}</p> : null}
      <Panel title="Leads" count={loading ? undefined : visible.length}>
        {loading ? <Bones /> : visible.length === 0 ? (
          <EmptyNote title="No leads in this stage" detail="Add a lead, or choose another stage." />
        ) : (
          <ul>
            {visible.map((card) => (
              <WorkRow
                key={card.leadId}
                name={card.customerName}
                meta={SOLAR_SALES_STAGE_LABEL[card.stage]}
                detail={`${card.nextAction}${card.location ? ` · ${card.location}` : ""}`}
                action="Open"
                onAction={() => void open(card.leadId)}
              />
            ))}
          </ul>
        )}
      </Panel>
      {addOpen ? (
        <SolarCreateSheet
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
