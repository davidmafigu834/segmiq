"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { SolarPanelActionKind } from "@/lib/sales/solar-workflow/opportunity";
import type { SolarSalesStage } from "@/lib/sales/solar-workflow";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { SendAssetPanel } from "@/components/leads/SendAssetPanel";
import { solarFollowUpWrite } from "@/lib/sales/solar-workflow/engagement";
import { SolarLeadWork } from "./SolarLeadWork";
import { lineBtn } from "./desk";
import "./solar-desk.css";

type Card = {
  stage: SolarSalesStage;
  stageLabel: string;
  nextAction: string;
  nextActionKind: SolarPanelActionKind;
  dealId: string | null;
  project: { id: string } | null;
  visit: { id: string; status: string; statusLabel: string; scheduledAt: string | null; site: string | null } | null;
  assessment: { status: "COMPLETED" | "DRAFT" | "NONE"; outcome: string | null; visitId: string | null };
  quotation: { id: string; number: string | null; statusLabel: string | null; total: number | null; currency: string } | null;
  requirement: { location: string | null };
  customer: { phone: string | null };
};

const JOURNEY: Array<{ id: SolarSalesStage; label: string }> = [
  { id: "NEW_LEAD", label: "New" },
  { id: "CONTACTED", label: "Contacted" },
  { id: "QUALIFIED", label: "Qualified" },
  { id: "SITE_VISIT_REQUIRED", label: "Visit" },
  { id: "PROPOSAL_PREPARED", label: "Proposal" },
  { id: "NEGOTIATION", label: "Negotiation" },
  { id: "WON", label: "Won" },
];

function journeyAt(stage: SolarSalesStage) {
  if (stage === "LOST") return -1;
  if (stage === "SITE_VISIT_COMPLETED") return 3;
  if (stage === "QUOTE_SENT") return 4;
  const index = JOURNEY.findIndex((step) => step.id === stage);
  return index < 0 ? 0 : index;
}

function money(total: number | null, currency: string) {
  if (total == null) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(total);
  } catch {
    return `${currency} ${total}`;
  }
}

export function SolarLeadDesk({
  leadId,
  name,
  phone,
  followUpDate,
  clientId,
  contactId,
  onSaved,
}: {
  leadId: string;
  name: string;
  phone: string | null;
  followUpDate: string | null;
  clientId?: string;
  contactId?: string | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logging, setLogging] = useState(false);
  const [call, setCall] = useState("");
  const [outcome, setOutcome] = useState("answered");
  const [followDate, setFollowDate] = useState("");
  const [followTime, setFollowTime] = useState("09:00");
  const [tab, setTab] = useState<"details" | "timeline" | "quote" | "send">("details");

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/solar-workflow/lead?leadId=${encodeURIComponent(leadId)}`);
    const json = (await res.json().catch(() => ({}))) as { card?: Card | null };
    setCard(json.card ?? null);
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(target: SolarSalesStage) {
    if (busy || card?.stage === target) return;
    if (target === "PROPOSAL_PREPARED" && card?.assessment.status === "COMPLETED" && !card.quotation) {
      router.push(card.dealId ? `/sales/quotes?dealId=${card.dealId}` : "/sales/quotes");
      return;
    }
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/sales/solar-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, target }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string; action?: string; dealId?: string | null };
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error || "The stage stayed where it is.");
      return;
    }
    if (json.action === "create_quote" || json.action === "send_quote") {
      router.push(json.dealId ? `/sales/quotes?dealId=${json.dealId}` : "/sales/quotes");
      return;
    }
    setStatus(json.message || "Stage updated.");
    await load();
    onSaved?.();
  }

  async function saveCall(event: FormEvent) {
    event.preventDefault();
    const text = call.trim();
    if (!text) return;
    if (outcome === "follow" && !followDate) {
      setStatus("Choose the date for this follow-up.");
      return;
    }
    setBusy(true);
    const when = outcome === "follow" ? ` Follow-up ${followDate} ${followTime}.` : "";
    const res = await fetch(`/api/leads/${leadId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: `Call · ${text}${when}` }),
    });
    if (!res.ok) {
      setBusy(false);
      setStatus("Could not save the call.");
      return;
    }
    if (outcome === "follow") {
      const write = solarFollowUpWrite(card?.dealId ?? null, followDate);
      const saved = write.resource === "deal"
        ? await fetch(`/api/deals/${card?.dealId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...write.body, next_action_at: new Date(`${followDate}T${followTime || "09:00"}`).toISOString() }),
          })
        : await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ follow_up_date: followDate }),
          });
      if (!saved.ok) {
        setBusy(false);
        setStatus("The call was saved. The follow-up date was not.");
        return;
      }
    }
    setBusy(false);
    setCall("");
    setLogging(false);
    setStatus(outcome === "follow" ? `Follow-up set for ${followDate} ${followTime}.` : "Call logged. The stage stays the same.");
    onSaved?.();
  }

  const stage = card?.stage ?? "NEW_LEAD";
  const at = journeyAt(stage);
  const visitHref = card?.visit ? `/sales/site-visits/${card.visit.id}` : "/sales/work";
  const quoteHref = card?.quotation
    ? `/sales/quotes/${card.quotation.id}`
    : card?.dealId
      ? `/sales/quotes?dealId=${card.dealId}`
      : "/sales/quotes";
  const assessmentDone = card?.assessment.status === "COMPLETED";
  const visitTitle = !card?.visit
    ? "Not scheduled"
    : assessmentDone
      ? card.assessment.outcome || "Completed"
      : card.visit.scheduledAt
        ? format(new Date(card.visit.scheduledAt), "EEE, HH:mm")
        : card.visit.statusLabel;
  const visitMeta = !card?.visit ? "Book a site assessment when the lead is ready." : assessmentDone ? "Completed" : card.visit.statusLabel;
  const visitAction = !card?.visit ? "Schedule" : "Open";
  const quoteMeta = card?.quotation
    ? [money(card.quotation.total, card.quotation.currency), card.quotation.statusLabel].filter(Boolean).join(" · ")
    : assessmentDone
      ? "Assessment is done. Start the quotation."
      : "Prepared after the site assessment.";
  const quoteAction = card?.quotation ? "Open" : assessmentDone ? "Prepare" : null;
  const nextHref =
    card?.nextActionKind === "prepare_proposal" || card?.nextActionKind === "send_quote"
      ? quoteHref
      : card?.nextActionKind === "open_visit" || card?.nextActionKind === "continue_assessment" || card?.nextActionKind === "schedule_visit"
        ? visitHref
        : card?.nextActionKind === "open_project" && card.project
          ? `/sales/projects/${card.project.id}`
          : null;
  const nextGo = card?.nextActionKind === "prepare_proposal" ? "Prepare" : nextHref ? "Open" : null;

  return (
    <div>
      {contactId ? (
        <a href={`/sales/contacts?contact=${contactId}`} className="block text-left">
          <p className="text-[13px] font-medium text-sales-text-muted">{card?.stageLabel ?? "Lead"}</p>
          <h2 className="mt-1 break-words font-display text-[28px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">{name}</h2>
        </a>
      ) : (
        <>
          <p className="text-[13px] font-medium text-sales-text-muted">{card?.stageLabel ?? "Lead"}</p>
          <h2 className="mt-1 break-words font-display text-[28px] font-semibold leading-none tracking-[-0.03em]">{name}</h2>
        </>
      )}
      {card?.requirement.location ? <p className="mt-2 text-[14px] text-sales-text-secondary">{card.requirement.location}</p> : null}
      <p className="mt-1 text-[13px] text-sales-text-muted">{phone || card?.customer.phone || "No phone on file"}</p>
      <div className="mt-4 flex gap-2 border-b border-sales-border" role="tablist">
        {(["details", "timeline", "quote", "send"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`border-b-2 px-3 py-2 text-[13px] font-semibold capitalize ${tab === id ? "border-sales-text-primary text-sales-text-primary" : "border-transparent text-sales-text-secondary"}`} onClick={() => setTab(id)}>{id}</button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {phone || card?.customer.phone ? <a className={lineBtn} href={`tel:${phone || card?.customer.phone}`}>Call</a> : null}
        <a className={lineBtn} href={`/sales/inbox?lead=${leadId}`}>WhatsApp</a>
        <button type="button" className={lineBtn} aria-expanded={logging} onClick={() => setLogging((open) => !open)}>Log call</button>
      </div>

      {logging ? (
        <form className="so-form" onSubmit={(event) => void saveCall(event)}>
          <label className="so-label" htmlFor={`solar-outcome-${leadId}`}>
            Outcome
            <select id={`solar-outcome-${leadId}`} value={outcome} onChange={(event) => setOutcome(event.target.value)} className="so-field">
              <option value="answered">Answered</option>
              <option value="no_answer">No answer</option>
              <option value="follow">Follow-up</option>
            </select>
          </label>
          <label className="so-label" htmlFor={`solar-call-${leadId}`}>
            What was said
            <textarea id={`solar-call-${leadId}`} value={call} onChange={(event) => setCall(event.target.value)} className="so-field" />
          </label>
          <div className="so-form-actions">
            {outcome === "follow" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="so-label">
                  Date
                  <input type="date" value={followDate} onChange={(event) => setFollowDate(event.target.value)} className="so-field" required />
                </label>
                <label className="so-label">
                  Time
                  <input type="time" value={followTime} onChange={(event) => setFollowTime(event.target.value)} className="so-field" required />
                </label>
              </div>
            ) : null}
            <button type="submit" className={`${lineBtn} h-11 w-full`} disabled={busy}>Save call</button>
          </div>
        </form>
      ) : null}
      {status ? <p className="mt-3 text-[13px] text-sales-text-secondary" role="status">{status}</p> : null}

      {tab === "timeline" ? <LeadTimeline leadId={leadId} /> : null}
      {tab === "quote" ? (
        <section className="so-record mt-6" aria-label="Quotation">
          <div className="so-record-row">
            <span className="so-record-kicker">Quotation</span>
            <span className="so-record-copy">
              <span className="so-record-value">{card?.quotation?.number || "None yet"}</span>
              {quoteMeta ? <span className="so-record-meta">{quoteMeta}</span> : null}
            </span>
          </div>
          {quoteAction ? (
            <button type="button" className={`${lineBtn} mt-3`} onClick={() => router.push(quoteHref)}>{quoteAction}</button>
          ) : null}
        </section>
      ) : null}
      {tab === "send" && clientId ? (
        <div className="mt-4">
          <SendAssetPanel leadId={leadId} clientId={clientId} leadPhone={phone || card?.customer.phone} onSent={() => setStatus("Sent.")} />
        </div>
      ) : null}
      {tab === "details" ? (
      <>
      <p className="mb-2 mt-6 text-[13px] text-sales-text-secondary">Click a stage to move this lead. A reminder does not.</p>
      <ol className="so-rail" aria-label="Solar journey">
        {JOURNEY.map((step, index) => {
          const current = stage !== "LOST" && (stage === "WON" ? index === JOURNEY.length - 1 : index === at);
          const done = stage !== "LOST" && !current && at >= 0 && index < at;
          const label = current ? (card?.stageLabel ?? step.label) : step.label;
          return (
            <li key={step.id}>
              <button type="button" className={`so-rail-step ${current ? "is-now" : done ? "is-done" : "is-ahead"}`} aria-current={current ? "step" : undefined} disabled={busy} onClick={() => void move(step.id)}>
                <span className="so-rail-mark" aria-hidden />
                <span className="so-rail-name">{label}</span>
                {current && stage !== "WON" ? <span className="so-rail-now">Now</span> : null}
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" className={`so-rail-step ${stage === "LOST" ? "is-now" : "is-ahead"}`} aria-current={stage === "LOST" ? "step" : undefined} disabled={busy} onClick={() => void move("LOST")}>
            <span className="so-rail-mark" aria-hidden />
            <span className="so-rail-name">Lost</span>
            {stage === "LOST" ? <span className="so-rail-now">Now</span> : null}
          </button>
        </li>
      </ol>

      <SolarLeadWork key={`${leadId}-${followUpDate ?? ""}`} leadId={leadId} followUpDate={followUpDate} onSaved={onSaved} />

      <section className="so-record mt-6" aria-label="On this lead">
        {nextHref ? (
          <button type="button" className="so-record-row so-record-next" onClick={() => router.push(nextHref)}>
            <span className="so-record-kicker">Next</span>
            <span className="so-record-copy"><span className="so-record-value">{card?.nextAction || "Open the lead"}</span></span>
            {nextGo ? <span className="so-record-go">{nextGo}</span> : null}
          </button>
        ) : (
          <div className="so-record-row so-record-next">
            <span className="so-record-kicker">Next</span>
            <span className="so-record-copy"><span className="so-record-value">{card?.nextAction || "Contact the lead"}</span></span>
          </div>
        )}
        <button type="button" className="so-record-row" onClick={() => router.push(visitHref)}>
          <span className="so-record-kicker">Visit</span>
          <span className="so-record-copy">
            <span className="so-record-value">{visitTitle}</span>
            <span className="so-record-meta">{visitMeta}</span>
          </span>
          <span className="so-record-go">{visitAction}</span>
        </button>
        {quoteAction ? (
          <button type="button" className="so-record-row" onClick={() => router.push(quoteHref)}>
            <span className="so-record-kicker">Quotation</span>
            <span className="so-record-copy">
              <span className="so-record-value">{card?.quotation?.number || "None yet"}</span>
              {quoteMeta ? <span className="so-record-meta">{quoteMeta}</span> : null}
            </span>
            <span className="so-record-go">{quoteAction}</span>
          </button>
        ) : (
          <div className="so-record-row">
            <span className="so-record-kicker">Quotation</span>
            <span className="so-record-copy">
              <span className="so-record-value">None yet</span>
              <span className="so-record-meta">{quoteMeta}</span>
            </span>
          </div>
        )}
      </section>
      </>
      ) : null}
    </div>
  );
}
