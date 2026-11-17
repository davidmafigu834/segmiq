"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ExternalLink, Phone, Plus } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { ActivityTimelineItem } from "@/lib/activity/types";
import type { SolarPanelActionKind } from "@/lib/sales/solar-workflow/opportunity";
import type { SolarSalesStage } from "@/lib/sales/solar-workflow";
import { solarFollowUpWrite } from "@/lib/sales/solar-workflow/engagement";
import { SolarLeadWork } from "./SolarLeadWork";
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
  const [logging, setLogging] = useState(true);
  const [call, setCall] = useState("");
  const [outcome, setOutcome] = useState("answered");
  const [followDate, setFollowDate] = useState("");
  const [followTime, setFollowTime] = useState("09:00");
  const [tab, setTab] = useState<"details" | "timeline" | "quote" | "send">("details");
  const [events, setEvents] = useState<ActivityTimelineItem[]>([]);
  const [asset, setAsset] = useState<"quote" | "package" | "photos">("package");
  const [sendNote, setSendNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/solar-workflow/lead?leadId=${encodeURIComponent(leadId)}`);
    const json = (await res.json().catch(() => ({}))) as { card?: Card | null };
    setCard(json.card ?? null);
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== "timeline") return;
    let live = true;
    void fetch(`/api/leads/${leadId}/timeline?limit=30`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { items?: ActivityTimelineItem[] };
        if (live) setEvents(json.items ?? []);
      })
      .catch(() => {
        if (live) setEvents([]);
      });
    return () => {
      live = false;
    };
  }, [tab, leadId, status]);

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

  async function deliver(event: FormEvent) {
    event.preventDefault();
    const choice = asset === "quote" && !card?.quotation ? "package" : asset;
    if (choice === "photos" && card?.assessment.status !== "COMPLETED") return;
    const label = choice === "quote" ? "Quotation" : choice === "photos" ? "Site photos" : "Package overview";
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: `Sent · ${label}${sendNote.trim() ? ` · ${sendNote.trim()}` : ""}` }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus("Could not record the send.");
      return;
    }
    setSendNote("");
    setStatus(`${label} recorded on the timeline.`);
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

  const dial = phone || card?.customer.phone || "";
  const place = card?.requirement.location || "No location on file";
  const mark = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "•";
  const quoteReady = Boolean(card?.quotation && card.quotation.total != null);
  const photosReady = card?.assessment.status === "COMPLETED";
  const closed = stage === "WON" || stage === "LOST";
  const dayGroups: Array<{ day: string; items: ActivityTimelineItem[] }> = [];
  for (const item of events) {
    const day = new Date(item.occurredAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const last = dayGroups[dayGroups.length - 1];
    if (last?.day === day) last.items.push(item);
    else dayGroups.push({ day, items: [item] });
  }
  const person = (
    <>
      <span className="so-lead-mark" aria-hidden>{mark}</span>
      <span className="min-w-0">
        <span className="so-lead-person-kicker">{card?.stageLabel ?? "Lead"}</span>
        <span className="so-lead-person-name">{name}</span>
        <span className="so-lead-person-meta">{place}{dial ? ` · ${dial}` : ""}</span>
      </span>
      <span className="so-lead-person-go">Customer</span>
    </>
  );

  return (
    <div>
      <header className="so-lead-head">
        {contactId ? (
          <a className="so-lead-person" href={`/sales/contacts?contact=${contactId}`}>{person}</a>
        ) : (
          <div className="so-lead-person">{person}</div>
        )}
      </header>
      <div className="flex shrink-0 border-b border-sales-border" role="tablist" aria-label="Lead">
        {(["details", "timeline", "quote", "send"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`so-lead-tab ${tab === id ? "is-on" : ""}`} onClick={() => setTab(id)}>
            {id === "details" ? "Details" : id === "timeline" ? "Timeline" : id === "quote" ? "Quote" : "Send"}
          </button>
        ))}
      </div>

      {tab === "timeline" ? (
        <div className="so-time">
          {dayGroups.length === 0 ? <p className="so-quote-copy">No activity yet.</p> : dayGroups.map((group) => (
            <section key={group.day}>
              <h3 className="so-time-day">{group.day}</h3>
              <ol className="so-time-rail">
                {group.items.map((item, index) => (
                  <li key={item.id} className={`so-time-row ${index === 0 && group === dayGroups[0] ? "is-latest" : ""}`}>
                    <span className="so-time-node" aria-hidden />
                    <div>
                      <p className="so-time-kind">{item.activityType.replaceAll("_", " ")}</p>
                      <p className="so-time-title">{item.title}</p>
                      {item.summary ? <p className="so-time-detail">{item.summary}</p> : null}
                      <p className="so-time-who">{item.actorName}</p>
                    </div>
                    <time className="so-time-when">{new Date(item.occurredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : null}

      {tab === "quote" ? (
        <div className="so-quote">
          <p className="so-quote-status">{card?.quotation?.statusLabel || (assessmentDone ? "Assessment done" : "Waiting")}</p>
          <div className="so-quote-head">
            <h3>{card?.quotation?.number || "No quotation"}</h3>
            {quoteMeta ? <p className="so-quote-amount">{money(card?.quotation?.total ?? null, card?.quotation?.currency || "USD") || card?.quotation?.statusLabel}</p> : null}
          </div>
          <p className="so-quote-copy">{quoteMeta}</p>
          <div className="so-quote-actions">
            {!card?.quotation && assessmentDone && stage !== "LOST" ? <button type="button" className="so-lead-btn" onClick={() => void move("PROPOSAL_PREPARED")}>Prepare quotation</button> : null}
            {card?.quotation ? <button type="button" className="so-lead-btn" onClick={() => router.push(quoteHref)}>Open quotation</button> : null}
            {card?.quotation && quoteReady ? <button type="button" className="so-lead-btn" onClick={() => void move("QUOTE_SENT")}>Send quotation</button> : null}
            {card?.project ? <button type="button" className="so-lead-btn" onClick={() => router.push(`/sales/projects/${card.project?.id}`)}>Open project</button> : null}
          </div>
          {status ? <p className="so-quote-note" role="status">{status}</p> : null}
        </div>
      ) : null}

      {tab === "send" ? (
        <form className="so-send" onSubmit={(event) => void deliver(event)}>
          <p className="so-send-kicker">To · {dial ? "Phone" : "No number"}</p>
          <p className="so-send-who">{name}</p>
          <p className="so-send-phone">{dial || "No phone on file"}</p>
          <fieldset className="so-send-set">
            <legend className="so-send-kicker">What to send</legend>
            <label className={quoteReady ? "so-send-choice" : "so-send-choice is-off"}>
              <input type="radio" name="solar-send" checked={asset === "quote"} disabled={!quoteReady} onChange={() => setAsset("quote")} />
              <span><span className="so-send-name">Quotation</span><span className="so-send-meta">{quoteReady ? quoteMeta : "Price a quotation before it can be sent."}</span></span>
            </label>
            <label className="so-send-choice">
              <input type="radio" name="solar-send" checked={asset === "package"} onChange={() => setAsset("package")} />
              <span><span className="so-send-name">Package overview</span><span className="so-send-meta">The system you are proposing.</span></span>
            </label>
            <label className={photosReady ? "so-send-choice" : "so-send-choice is-off"}>
              <input type="radio" name="solar-send" checked={asset === "photos"} disabled={!photosReady} onChange={() => setAsset("photos")} />
              <span><span className="so-send-name">Site photos</span><span className="so-send-meta">{photosReady ? "From the completed visit." : "The visit is not complete."}</span></span>
            </label>
          </fieldset>
          <label className="so-label so-send-note" htmlFor={`solar-send-${leadId}`}>
            Note
            <textarea id={`solar-send-${leadId}`} value={sendNote} onChange={(event) => setSendNote(event.target.value)} className="so-field" />
          </label>
          <button type="submit" className="so-lead-btn" disabled={busy}>Send {asset === "quote" ? "quotation" : asset === "photos" ? "site photos" : "package overview"}</button>
          {status ? <p className="so-send-note-out" role="status">{status}</p> : null}
        </form>
      ) : null}

      {tab === "details" ? (
      <div>
      <div className="space-y-4 p-5">
        <div className="so-lead-card">
          <p className="so-lead-kicker">Next</p>
          <p className="mt-1 text-[14px] font-semibold">{card?.nextAction || "Contact the lead"}</p>
          <p className="mt-0.5 text-[12px] text-sales-text-secondary">{place}</p>
        </div>
        <button type="button" className="so-lead-card block w-full text-left" onClick={() => router.push(visitHref)}>
          <p className="so-lead-kicker">Site visit</p>
          <p className="mt-1 text-[14px] font-semibold">{visitTitle}</p>
          <p className="mt-0.5 text-[12px] text-sales-text-secondary">{visitMeta}</p>
        </button>
        {dial ? <a className="block font-mono text-[15px] text-sales-info" href={`tel:${dial}`}>{dial}</a> : <p className="text-[13px] text-sales-text-muted">No phone on file</p>}
        {closed ? null : (
          <div className="flex gap-2">
            <button type="button" className="so-lead-btn" onClick={() => void move("WON")}>Record won customer</button>
            <button type="button" className="so-lead-btn" onClick={() => void move("LOST")}>Mark not qualified</button>
          </div>
        )}
        <div>
          <p className="so-lead-kicker mb-2.5">Quick actions</p>
          <div className="flex gap-2">
            <a className="so-lead-qa" href={`/sales/inbox?lead=${leadId}`}><SiWhatsapp size={18} color="#25D366" aria-hidden />WhatsApp</a>
            {dial ? <a className="so-lead-qa" href={`tel:${dial}`}><Phone size={18} strokeWidth={1.8} aria-hidden />Call</a> : null}
            <button type="button" className="so-lead-qa" onClick={() => setLogging(true)}><Plus size={18} strokeWidth={1.8} aria-hidden />Log call</button>
            <button type="button" className="so-lead-qa" onClick={() => setTab("send")}><ExternalLink size={18} strokeWidth={1.8} aria-hidden />Send assets</button>
          </div>
        </div>
      </div>
      {logging ? (
        <form id="solar-log-call" className="so-form so-form-card mx-5 mb-5" onSubmit={(event) => void saveCall(event)}>
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
            <button type="submit" className="so-lead-btn" disabled={busy}>Save call</button>
          </div>
        </form>
      ) : null}
      {status ? <p className="px-5 text-[13px] text-sales-text-secondary" role="status">{status}</p> : null}
      <div className="space-y-4 px-5 pb-5">
      <p className="text-[13px] text-sales-text-secondary">Click a stage to move this lead. A reminder does not.</p>
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
      </div>
      </div>
      ) : null}
    </div>
  );
}
