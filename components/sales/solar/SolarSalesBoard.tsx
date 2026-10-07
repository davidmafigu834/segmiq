"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { formatDistanceToNow, format } from "date-fns";
import { SOLAR_SALES_STAGES, SOLAR_SALES_STAGE_LABEL, type SolarSalesStage } from "@/lib/sales/solar-workflow";
import { LOST_REASONS } from "@/lib/call-log-constants";
import { CreateFromDealDialog } from "@/components/work-projects/CreateFromDealDialog";
import { useSalesToast } from "@/components/sales/ui";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

type Card = {
  leadId: string;
  dealId: string | null;
  stage: SolarSalesStage;
  customerName: string;
  service: string | null;
  location: string | null;
  sourceLabel: string | null;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: string;
  value: number | null;
  currency: string;
  nextAction: string;
  quoteAccepted: boolean;
  visit: { id: string; status: string; scheduledStartAt: string | null; assigneeName: string | null } | null;
  assessment: { completedAt: string | null; outcome: string | null; loads: string | null } | null;
  quote: { id: string; number: string | null; total: number | null; currency: string; status: string; sentAt: string | null; viewed: boolean } | null;
};

type Payload = {
  preset: string;
  cards: Card[];
  report: {
    newEnquiries: number;
    contactRate: number | null;
    qualificationRate: number | null;
    siteVisitRequired: number;
    siteVisitsCompleted: number;
    siteVisitToProposalRate: number | null;
    proposalPrepared: number;
    quotesSent: number;
    quoteToWonRate: number | null;
    negotiation: number;
    won: number;
    lost: number;
  };
  staff: Array<{ id: string; name: string | null }>;
};

function money(value: number | null, currency: string) {
  if (value == null || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function when(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "EEEE · HH:mm");
}

export function SolarSalesBoard({
  scope,
  settingsHref,
  quotesHref,
  visitHref,
  projectsHref,
}: {
  scope: "mine" | "team";
  settingsHref?: string;
  quotesHref: string;
  visitHref: string;
  projectsHref: "/sales/projects" | "/client/projects";
}) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const compact = useMediaQuery("(max-width: 767px)");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [stageFilter, setStageFilter] = useState<SolarSalesStage | "all">(compact ? "NEW_LEAD" : "all");
  const [ownerId, setOwnerId] = useState("all");
  const [source, setSource] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [valueMin, setValueMin] = useState("");
  const [scheduleFor, setScheduleFor] = useState<Card | null>(null);
  const [lostFor, setLostFor] = useState<Card | null>(null);
  const [wonFor, setWonFor] = useState<Card | null>(null);
  const [projectFor, setProjectFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const params = new URLSearchParams();
    if (ownerId !== "all") params.set("ownerId", ownerId);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
    if (valueMin) params.set("valueMin", valueMin);
    const res = await fetch(`/api/sales/solar-workflow?${params.toString()}`);
    const json = (await res.json().catch(() => ({}))) as Payload & { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not load the solar pipeline.");
      return;
    }
    setData(json);
    setError("");
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, from, to, valueMin]);

  const sources = useMemo(() => {
    const set = new Set((data?.cards ?? []).map((card) => card.sourceLabel).filter(Boolean) as string[]);
    return [...set];
  }, [data]);

  const visibleStages = compact && stageFilter !== "all" ? [stageFilter] : [...SOLAR_SALES_STAGES];

  async function move(card: Card, target: SolarSalesStage) {
    setBusy(true);
    const res = await fetch("/api/sales/solar-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: card.leadId, target }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      action?: string;
      dealId?: string | null;
      promptSchedule?: boolean;
    };
    setBusy(false);
    if (!res.ok) {
      if (json.action === "complete_visit" && card.visit) router.push(`${visitHref}/${card.visit.id}`);
      else if (json.action === "create_quote" && (json.dealId || card.dealId)) router.push(`${quotesHref}?dealId=${json.dealId || card.dealId}`);
      else if (json.action === "send_quote" && card.quote) router.push(`${quotesHref}/${card.quote.id}`);
      toast({ title: json.error || json.message || "That move is not available yet.", tone: "warning" });
      return;
    }
    if (json.action === "create_quote" && (json.dealId || card.dealId)) {
      router.push(`${quotesHref}?dealId=${json.dealId || card.dealId}`);
      return;
    }
    if (json.action === "send_quote" && card.quote) {
      router.push(`${quotesHref}/${card.quote.id}`);
      return;
    }
    if (json.action === "mark_won") {
      setWonFor({ ...card, dealId: json.dealId ?? card.dealId });
      return;
    }
    if (json.action === "mark_lost") {
      setLostFor({ ...card, dealId: json.dealId ?? card.dealId });
      return;
    }
    if (json.promptSchedule) setScheduleFor(card);
    toast({ title: json.message || "Updated", tone: "success" });
    await reload();
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const target = result.destination.droppableId as SolarSalesStage;
    const card = data?.cards.find((row) => row.leadId === result.draggableId);
    if (!card || card.stage === target) return;
    void move(card, target);
  }

  async function runPrimary(card: Card) {
    if (card.nextAction === "Schedule site visit") return void move(card, "SITE_VISIT_REQUIRED");
    if (card.nextAction === "Schedule visit") {
      setScheduleFor(card);
      return;
    }
    if (card.nextAction === "Open visit" && card.visit) {
      router.push(`${visitHref}/${card.visit.id}`);
      return;
    }
    if (card.nextAction === "Prepare proposal" && card.dealId) {
      router.push(`${quotesHref}?dealId=${card.dealId}`);
      return;
    }
    if (card.nextAction === "Send quote" && card.quote) {
      router.push(`${quotesHref}/${card.quote.id}`);
      return;
    }
    if (card.nextAction === "Contact lead") return void move(card, "CONTACTED");
    if (card.nextAction === "Qualify") return void move(card, "QUALIFIED");
    if (card.nextAction === "Follow up") return void move(card, "NEGOTIATION");
    if (card.nextAction === "Mark deal won") setWonFor(card);
    if (card.nextAction === "Create project" && card.dealId) setProjectFor(card.dealId);
  }

  const report = data?.report;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold text-sales-text-primary">Solar sales</h1>
          <p className="text-[13px] text-sales-text-secondary">One pipeline from new lead to won. Delivery starts after the project is created.</p>
        </div>
        {settingsHref ? <Link href={settingsHref} className="inline-flex min-h-11 items-center text-[13px] font-medium text-sales-text-secondary">Workflow settings</Link> : null}
      </div>
      {scope === "team" && report ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Metric label="Need a site visit" value={report.siteVisitRequired} />
          <Metric label="Assessments completed" value={report.siteVisitsCompleted} />
          <Metric label="Proposals unsent" value={report.proposalPrepared} />
          <Metric label="In negotiation" value={report.negotiation} />
          <Metric label="Quote to won" value={report.quoteToWonRate == null ? "—" : `${report.quoteToWonRate}%`} />
        </div>
      ) : null}
      {scope === "team" ? (
        <div className="flex flex-wrap gap-2">
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="min-h-11 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]">
            <option value="all">All salespeople</option>
            {(data?.staff ?? []).map((person) => (
              <option key={person.id} value={person.id}>{person.name || "Team member"}</option>
            ))}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="min-h-11 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]">
            <option value="all">All sources</option>
            {sources.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="min-h-11 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="min-h-11 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]" />
          <input inputMode="decimal" value={valueMin} onChange={(e) => setValueMin(e.target.value)} placeholder="Min value" aria-label="Minimum value" className="min-h-11 w-32 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]" />
        </div>
      ) : null}
      {compact ? (
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as SolarSalesStage)} className="min-h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[14px] font-medium">
          {SOLAR_SALES_STAGES.map((stage) => (
            <option key={stage} value={stage}>{SOLAR_SALES_STAGE_LABEL[stage]}</option>
          ))}
        </select>
      ) : null}
      {error ? <p className="text-[13px] text-sales-danger-fg">{error}</p> : null}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className={compact ? "space-y-3" : "flex gap-3 overflow-x-auto pb-4"}>
          {visibleStages.map((stage) => {
            const cards = (data?.cards ?? []).filter((card) => card.stage === stage && (source === "all" || card.sourceLabel === source));
            return (
              <Droppable droppableId={stage} key={stage}>
                {(provided) => (
                  <section ref={provided.innerRef} {...provided.droppableProps} className={compact ? "space-y-2" : "w-[260px] shrink-0 space-y-2"}>
                    <header className="flex items-baseline justify-between px-1">
                      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-sales-text-secondary">{SOLAR_SALES_STAGE_LABEL[stage]}</h2>
                      <span className="text-[12px] tabular-nums text-sales-text-muted">{cards.length}</span>
                    </header>
                    {cards.map((card, index) => (
                      <Draggable draggableId={card.leadId} index={index} key={card.leadId} isDragDisabled={compact || busy}>
                        {(drag) => (
                          <article ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} className="rounded-[12px] border border-sales-border bg-sales-surface p-3">
                            <p className="text-[15px] font-semibold text-sales-text-primary">{card.customerName}</p>
                            <p className="mt-0.5 text-[13px] text-sales-text-secondary">{[card.location, card.service].filter(Boolean).join(" · ") || "Solar enquiry"}</p>
                            {stage === "NEW_LEAD" || stage === "CONTACTED" ? (
                              <p className="mt-2 text-[12px] text-sales-text-muted">{[card.sourceLabel, formatDistanceToNow(new Date(card.updatedAt), { addSuffix: true })].filter(Boolean).join(" · ")}</p>
                            ) : null}
                            {stage === "SITE_VISIT_REQUIRED" ? (
                              <p className="mt-2 text-[13px] text-sales-text-primary">
                                {card.visit?.scheduledStartAt ? `${when(card.visit.scheduledStartAt)}${card.visit.assigneeName ? ` · ${card.visit.assigneeName}` : ""}` : "Site visit not scheduled"}
                              </p>
                            ) : null}
                            {stage === "SITE_VISIT_COMPLETED" && card.assessment ? (
                              <div className="mt-2 text-[13px] text-sales-text-secondary">
                                <p>Assessment completed {card.assessment.completedAt ? format(new Date(card.assessment.completedAt), "d MMM") : ""}</p>
                                {card.assessment.outcome ? <p>{card.assessment.outcome}</p> : null}
                                {card.assessment.loads ? <p>{card.assessment.loads}</p> : null}
                              </div>
                            ) : null}
                            {card.quote && (stage === "PROPOSAL_PREPARED" || stage === "QUOTE_SENT" || stage === "NEGOTIATION" || stage === "WON") ? (
                              <div className="mt-2 text-[13px]">
                                <p className="font-medium text-sales-text-primary">{card.quote.number || "Quotation"} · {money(card.quote.total, card.quote.currency)}</p>
                                <p className="text-sales-text-secondary">
                                  {card.quote.sentAt ? `Sent ${formatDistanceToNow(new Date(card.quote.sentAt), { addSuffix: true })}` : card.quote.status.replaceAll("_", " ")}
                                  {card.quote.sentAt ? ` · ${card.quote.viewed ? "Viewed" : "Not viewed"}` : ""}
                                </p>
                                {card.quoteAccepted ? <p className="text-sales-text-primary">Customer accepted quotation</p> : null}
                              </div>
                            ) : null}
                            {card.nextAction ? (
                              <button type="button" onClick={() => void runPrimary(card)} className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-primary">
                                {card.nextAction}
                              </button>
                            ) : null}
                          </article>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </section>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
      {scheduleFor ? (
        <ScheduleDialog
          card={scheduleFor}
          staff={data?.staff ?? []}
          onClose={() => setScheduleFor(null)}
          onSaved={() => {
            setScheduleFor(null);
            void reload();
          }}
        />
      ) : null}
      {lostFor?.dealId ? (
        <LostDialog
          dealId={lostFor.dealId}
          onClose={() => setLostFor(null)}
          onSaved={() => {
            setLostFor(null);
            void reload();
          }}
        />
      ) : null}
      {wonFor?.dealId ? (
        <WonDialog
          dealId={wonFor.dealId}
          hint={money(wonFor.value, wonFor.currency)}
          onClose={() => setWonFor(null)}
          onSaved={() => {
            const dealId = wonFor.dealId;
            setWonFor(null);
            void reload();
            if (dealId) setProjectFor(dealId);
          }}
        />
      ) : null}
      {projectFor ? (
        <CreateFromDealDialog
          dealId={projectFor}
          projectBasePath={projectsHref}
          existingProjectId={null}
          owners={data?.staff ?? []}
          onClose={() => setProjectFor(null)}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[12px] border border-sales-border bg-sales-surface px-3 py-2">
      <p className="text-[12px] text-sales-text-secondary">{label}</p>
      <p className="text-[1.25rem] font-semibold tabular-nums text-sales-text-primary">{value}</p>
    </div>
  );
}

function ScheduleDialog({
  card,
  staff,
  onClose,
  onSaved,
}: {
  card: Card;
  staff: Array<{ id: string; name: string | null }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useSalesToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [assignedToId, setAssignedToId] = useState(staff[0]?.id ?? "");
  const [site, setSite] = useState(card.location ?? "");
  const [instructions, setInstructions] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!date || !assignedToId) {
      toast({ title: "Choose a date and who is going.", tone: "warning" });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/sales/site-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: card.leadId,
        startAt: new Date(`${date}T${time}`).toISOString(),
        durationMinutes: duration,
        assignedToId,
        siteAddress: site,
        instructions,
        notifyCustomer: notify,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      toast({ title: json.error || "Could not schedule the visit.", tone: "error" });
      return;
    }
    toast({ title: "Site visit scheduled", tone: "success" });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[16px] bg-sales-surface p-5 sm:rounded-[16px]">
        <h2 className="text-[1.25rem] font-semibold">Schedule site visit</h2>
        <p className="mt-1 text-[13px] text-sales-text-secondary">{card.customerName}. This is a pre-sale visit.</p>
        <label className="mt-4 block text-[12px] font-medium">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
        <label className="mt-3 block text-[12px] font-medium">Time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
        <label className="mt-3 block text-[12px] font-medium">Duration
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3">
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>90 minutes</option>
            <option value={120}>2 hours</option>
          </select>
        </label>
        <label className="mt-3 block text-[12px] font-medium">Assigned staff
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3">
            {staff.map((person) => (
              <option key={person.id} value={person.id}>{person.name || "Team member"}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-[12px] font-medium">Site<input value={site} onChange={(e) => setSite(e.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
        <label className="mt-3 block text-[12px] font-medium">Instructions<textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="mt-1 w-full rounded-[10px] border border-sales-border px-3 py-2" /></label>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-[13px]"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Notify customer?</label>
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-4 min-h-11 w-full rounded-[10px] bg-sales-text-primary text-[14px] font-semibold text-white disabled:opacity-50">{saving ? "Scheduling…" : "Schedule visit"}</button>
        <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full text-[13px] font-semibold text-sales-text-secondary">Cancel</button>
      </div>
    </div>
  );
}

function LostDialog({ dealId, onClose, onSaved }: { dealId: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useSalesToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!reason) return;
    setSaving(true);
    const res = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ close: { outcome: "LOST", lostReason: reason } }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: json.error || "Could not mark this lost.", tone: "error" });
      return;
    }
    toast({ title: "Marked lost. No project was created.", tone: "success" });
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-[16px] bg-sales-surface p-5 sm:rounded-[16px]">
        <h2 className="text-[1.25rem] font-semibold">Mark lost</h2>
        <label className="mt-3 block text-[12px] font-medium">Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3">
            <option value="">Choose a reason</option>
            {LOST_REASONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!reason || saving} onClick={() => void save()} className="mt-4 min-h-11 w-full rounded-[10px] bg-sales-text-primary text-[14px] font-semibold text-white disabled:opacity-50">Mark lost</button>
        <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full text-[13px] font-semibold text-sales-text-secondary">Cancel</button>
      </div>
    </div>
  );
}

function WonDialog({
  dealId,
  hint,
  onClose,
  onSaved,
}: {
  dealId: string;
  hint: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useSalesToast();
  const [value, setValue] = useState(hint?.replace(/[^0-9.]/g, "") ?? "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const res = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ close: { outcome: "WON", wonValue: Number(value) || 0 } }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: json.error || "Could not mark this won.", tone: "error" });
      return;
    }
    toast({ title: "Deal won", tone: "success" });
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-[16px] bg-sales-surface p-5 sm:rounded-[16px]">
        <h2 className="text-[1.25rem] font-semibold">Mark deal won</h2>
        <label className="mt-3 block text-[12px] font-medium">Won value
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3" />
        </label>
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-4 min-h-11 w-full rounded-[10px] bg-sales-text-primary text-[14px] font-semibold text-white">Mark won</button>
        <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full text-[13px] font-semibold text-sales-text-secondary">Cancel</button>
      </div>
    </div>
  );
}
