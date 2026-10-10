"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, ArrowLeftRight, PanelRightClose } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import { CreateFromDealDialog } from "@/components/work-projects/CreateFromDealDialog";
import { TransferDialog } from "@/components/inbox/TransferDialog";
import { TransferToSupportDialog } from "@/components/inbox/TransferToSupportDialog";
import { displayContactName, WhatsAppAvatar } from "@/components/inbox/WhatsAppAvatar";
import { SalesCopilotPanel } from "@/components/inbox/SalesCopilotWorkspace";
import { formatCurrencyAmount, hasMeaningfulScore } from "@/lib/inbox/format-display";
import type { InboxConversation } from "@/lib/inbox/types";
import type { SolarPanelActionKind } from "@/lib/sales/solar-workflow/opportunity";
import {
  resolveSolarEngagement,
  solarFollowUpWrite,
  type SolarEngagementActionKind,
  type SolarNextAction,
} from "@/lib/sales/solar-workflow/engagement";
import type { SolarSalesStage } from "@/lib/sales/solar-workflow";
import type { QuotationLineItemRow, QuotationRow } from "@/types";

type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type Snapshot = {
  stage: SolarSalesStage;
  stageLabel: string;
  nextAction: string;
  nextActionKind: SolarPanelActionKind;
  insight: string | null;
  progress: Array<{ id: string; label: string; state: "done" | "current" | "upcoming" }>;
  handoff: boolean;
  customer: {
    name: string;
    phone: string | null;
    sourceLabel: string | null;
    ownerName: string | null;
    kind: "new" | "existing";
  };
  dealId: string | null;
  dealName: string | null;
  wonValue: number | null;
  currency: string;
  opportunities: Array<{ id: string; name: string }>;
  requirement: {
    service: string | null;
    location: string | null;
    loads: string | null;
    timeline: string | null;
    budget: string | null;
  };
  missing: string[];
  visit: {
    id: string;
    status: string;
    statusLabel: string;
    scheduledAt: string | null;
    assigneeName: string | null;
    site: string | null;
  } | null;
  assessment: {
    status: "NONE" | "DRAFT" | "COMPLETED";
    inProgress: boolean;
    sectionsDone: number;
    sectionsTotal: number;
    completedAt: string | null;
    outcome: string | null;
    power: string[];
    loads: string | null;
    roof: string | null;
    visitId: string | null;
  };
  quotation: {
    id: string;
    number: string | null;
    status: string;
    statusLabel: string | null;
    total: number | null;
    currency: string;
    sentAt: string | null;
    viewedAt: string | null;
    acceptedAt: string | null;
  } | null;
  project: { id: string; number: string; status: string; statusLabel: string } | null;
  installedSystem: {
    headline: string;
    lines: string[];
    installedLabel: string | null;
    projectId: string | null;
  } | null;
  reminderAt: string | null;
  visitId: string | null;
  projectId: string | null;
  proposalNotes: string | null;
};

type Props = {
  conversation: InboxConversation;
  clientId: string;
  userId: string;
  salespeople: { id: string; name: string }[];
  canReassign: boolean;
  canTransfer: boolean;
  canModifyDeal: boolean;
  canClaim: boolean;
  claiming: boolean;
  onClaim: (leadId: string) => void;
  onUpdated: () => void;
  open: boolean;
  onCollapse: () => void;
  onMobileBack?: () => void;
  mobileFullScreen?: boolean;
  mobileTopClass?: string;
  panelWidth?: number;
  panelAnimated?: boolean;
  refreshKey?: number;
};

export function SolarOpportunityPanel({
  conversation,
  clientId,
  userId,
  salespeople,
  canReassign,
  canTransfer,
  canModifyDeal,
  canClaim,
  claiming,
  onClaim,
  onUpdated,
  open,
  onCollapse,
  onMobileBack,
  mobileFullScreen = false,
  panelWidth,
  panelAnimated = false,
  refreshKey = 0,
}: Props) {
  const router = useRouter();
  const [card, setCard] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [wonOpen, setWonOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuotationWithItems | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    void fetch(`/api/sales/solar-workflow/lead?leadId=${encodeURIComponent(conversation.id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("snapshot_failed");
        return (await response.json()) as { card?: Snapshot | null };
      })
      .then((json) => {
        if (!cancelled) setCard(json.card ?? null);
      })
      .catch((error: Error) => {
        if (!cancelled && error.name !== "AbortError") setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [conversation.id, refreshKey]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const name = card?.customer.name || displayContactName(conversation);
  const phone = card?.customer.phone || conversation.phone;
  const owner = card?.customer.ownerName || conversation.assignee?.name || "Unassigned";
  const earlyScore =
    card && (card.stage === "NEW_LEAD" || card.stage === "CONTACTED") && hasMeaningfulScore(conversation.score, conversation.breakdown)
      ? conversation.score
      : null;
  const panelClass =
    panelWidth == null
      ? "w-[min(100%,380px)] min-w-0 shrink-0 max-[1099px]:w-full max-[1099px]:max-w-none"
      : "min-w-0 shrink-0 max-[1099px]:w-full max-[1099px]:max-w-none";
  const mobileClass = mobileFullScreen
    ? open
      ? "max-[1099px]:relative max-[1099px]:z-auto max-[1099px]:flex max-[1099px]:h-full max-[1099px]:w-full max-[1099px]:max-w-none max-[1099px]:flex-1"
      : "max-[1099px]:hidden"
    : open
      ? "max-[1279px]:translate-x-0"
      : "max-[1279px]:translate-x-full";
  const drawerClass = mobileFullScreen
    ? ""
    : `min-[1100px]:max-[1279px]:fixed min-[1100px]:max-[1279px]:bottom-0 min-[1100px]:max-[1279px]:right-0 min-[1100px]:max-[1279px]:top-0 min-[1100px]:max-[1279px]:z-40 min-[1100px]:max-[1279px]:w-[min(390px,94vw)] min-[1100px]:max-[1279px]:shadow-[-12px_0_28px_rgba(16,24,40,0.14)] min-[1100px]:max-[1279px]:transition-transform`;

  async function reload() {
    onUpdated();
    const response = await fetch(`/api/sales/solar-workflow/lead?leadId=${encodeURIComponent(conversation.id)}`);
    if (!response.ok) return;
    const json = (await response.json()) as { card?: Snapshot | null };
    setCard(json.card ?? null);
  }

  async function transition(target: "CONTACTED" | "QUALIFIED" | "SITE_VISIT_REQUIRED") {
    const response = await fetch("/api/sales/solar-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: conversation.id, target }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(json.error || "That step is not available.");
  }

  async function openQuotation(create: boolean) {
    if (!card) return;
    if (card.quotation?.id) {
      const response = await fetch(`/api/quotations/${card.quotation.id}`);
      const json = (await response.json()) as { quotation?: QuotationWithItems };
      if (json.quotation) setEditingQuote(json.quotation);
      else setMessage("Could not open the quotation.");
      return;
    }
    if (!create) {
      setMessage("No proposal has been prepared.");
      return;
    }
    const response = await fetch(`/api/leads/${conversation.id}/quotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: card.dealId,
        notes: card.proposalNotes,
      }),
    });
    const json = (await response.json()) as { quotation?: QuotationWithItems; error?: string };
    if (json.quotation) setEditingQuote(json.quotation);
    else setMessage(json.error || "Could not prepare the proposal.");
  }

  async function runWorkflow(kind: SolarEngagementActionKind) {
    if (!card || busy) return;
    if (kind === "follow_up") {
      setMessage("Send the follow-up in this conversation. The sales stage stays the same.");
      return;
    }
    if (kind === "schedule_follow_up") {
      setReminderOpen(true);
      return;
    }
    if (kind === "reply" || kind === "ask" || kind === "none") return;
    if (kind === "open_visit" || kind === "continue_assessment") {
      const visitId = card.visitId || card.assessment.visitId;
      if (visitId) router.push(`/sales/site-visits/${visitId}`);
      return;
    }
    if (kind === "open_project" && card.projectId) {
      router.push(`/sales/projects/${card.projectId}`);
      return;
    }
    if (!canModifyDeal) return;
    if (kind === "schedule_visit") {
      setScheduleOpen(true);
      return;
    }
    if (kind === "mark_won") {
      setWonOpen(true);
      return;
    }
    if (kind === "create_project" && card.dealId) {
      setProjectOpen(true);
      return;
    }
    if (kind === "prepare_proposal" || kind === "send_quote") {
      setBusy(true);
      try {
        await openQuotation(kind === "prepare_proposal");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (kind === "qualify") {
      setBusy(true);
      try {
        await transition("QUALIFIED");
        setMessage("Marked as qualified.");
        await reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not update this opportunity.");
      } finally {
        setBusy(false);
      }
    }
  }

  async function saveReminder(dateValue: string) {
    if (!card || !canModifyDeal || busy) return;
    const write = solarFollowUpWrite(card.dealId, dateValue);
    setBusy(true);
    try {
      const response = write.resource === "deal"
        ? await fetch(`/api/deals/${card.dealId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(write.body),
          })
        : await fetch(`/api/leads/${conversation.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(write.body),
          });
      if (!response.ok) {
        setMessage("Could not save the reminder.");
        return;
      }
      setReminderOpen(false);
      setMessage("Reminder saved.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const visitScheduled = Boolean(card?.visit && ["SCHEDULED", "ON_SITE", "RESCHEDULED"].includes(card.visit.status));
  const plan = card
    ? resolveSolarEngagement({
        stage: card.stage,
        now: new Date(),
        lastMessageDirection: conversation.lastMessageDirection,
        lastMessageAt: conversation.lastMessageAt,
        followUpAt: card.reminderAt,
        service: card.requirement.service,
        location: card.requirement.location,
        timeline: card.requirement.timeline,
        budget: card.requirement.budget,
        visitScheduled,
        visitAt: card.visit?.scheduledAt ?? null,
        assessmentCompletedAt: card.assessment.completedAt,
        quote: card.quotation
          ? {
              number: card.quotation.number,
              total: card.quotation.total,
              currency: card.quotation.currency,
              sentAt: card.quotation.sentAt,
              viewedAt: card.quotation.viewedAt,
              acceptedAt: card.quotation.acceptedAt,
              status: card.quotation.statusLabel,
            }
          : null,
        workflowKind: card.nextActionKind,
        workflowLabel: card.nextAction,
        hasProject: Boolean(card.project),
      })
    : null;
  const stillNeeded =
    card && (card.stage === "NEW_LEAD" || card.stage === "CONTACTED")
      ? plan?.qualification.missingFields ?? []
      : card?.missing ?? [];

  return (
    <aside
      id="intelPanel"
      style={panelWidth != null ? { width: panelWidth } : undefined}
      className={`salesperson-wa-context-pane wa-context-pane flex h-full min-h-0 min-w-0 flex-col border-l border-sales-border bg-sales-surface ${panelClass} ${mobileClass} ${drawerClass} ${
        panelAnimated ? "inbox-panel-animated" : ""
      }`}
      data-course-target="whatsapp-solar-opportunity"
    >
      <header className="flex min-h-[52px] shrink-0 items-center gap-2 border-b border-sales-border px-3.5 max-[1099px]:pt-[max(0.75rem,env(safe-area-inset-top))]">
        {onMobileBack ? (
          <button type="button" onClick={onMobileBack} className="wa-icon-btn-muted shrink-0" aria-label="Back to conversation">
            <ArrowLeft size={19} />
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.02em] text-sales-text-primary">Solar opportunity</h2>
        <button type="button" onClick={onCollapse} className="wa-icon-btn !h-8 !w-8" aria-label="Hide solar opportunity">
          <PanelRightClose size={15} />
        </button>
      </header>

      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto bg-sales-surface pb-[env(safe-area-inset-bottom)]">
        <SalesCopilotPanel leadId={conversation.id} />
        {loading ? <SolarSkeleton /> : null}
        {!loading && loadError ? (
          <p className="p-4 text-[13px] text-sales-text-secondary">CRM context is temporarily unavailable. Messaging remains active.</p>
        ) : null}
        {!loading && !loadError && !card ? (
          <p className="p-4 text-[13px] text-sales-text-secondary">This lead is not on the solar sales workflow.</p>
        ) : null}
        {!loading && card ? (
          <>
            <div className="sticky top-0 z-10 border-b border-sales-border bg-sales-surface px-3.5 py-3">
              <div className="flex items-start gap-3">
                <WhatsAppAvatar name={name} phone={phone} imageUrl={conversation.whatsappProfilePictureUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-sales-text-label">Customer</p>
                  <div className="truncate text-[15px] font-semibold tracking-tight text-sales-text-primary">{name}</div>
                  <div className="mt-0.5 text-[13px] font-medium text-sales-text-primary">{card.stage === "LOST" ? "Lost" : card.stageLabel}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[12px] text-sales-whatsapp">
                    <SiWhatsapp size={12} />
                    <span className="truncate tabular-nums">{phone || "WhatsApp"}</span>
                  </div>
                </div>
              </div>
              {plan ? (
                <EngagementBlock
                  plan={plan}
                  busy={busy}
                  canModifyDeal={canModifyDeal}
                  reminderOpen={reminderOpen}
                  reminderDate={reminderDate}
                  onReminderDate={setReminderDate}
                  onReminderOpen={setReminderOpen}
                  onRun={(action) => void runWorkflow(action.kind)}
                  onSchedule={(date) => void saveReminder(format(date, "yyyy-MM-dd"))}
                />
              ) : null}
            </div>

            <Section title="Account">
              <p className="text-[12.5px] text-sales-text-secondary">
                {card.customer.kind === "existing" ? "Existing customer" : "New customer"}
                {card.customer.sourceLabel ? ` · ${card.customer.sourceLabel}` : ""}
              </p>
              <p className="mt-1 text-[12.5px] text-sales-text-secondary">Owner · {owner}</p>
              {earlyScore != null ? (
                <p className="mt-2 text-[12px] text-sales-text-muted">Lead score · {earlyScore}</p>
              ) : null}
              {!conversation.assignedToId && canClaim ? (
                <button
                  type="button"
                  disabled={claiming}
                  onClick={() => onClaim(conversation.id)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[9px] border border-sales-border px-3 text-[13px] font-semibold"
                >
                  {claiming ? "Claiming…" : "Claim lead"}
                </button>
              ) : null}
              {card.opportunities.length > 1 ? (
                <label className="mt-3 block text-[12px] font-medium text-sales-text-secondary">
                  Multiple opportunities
                  <select
                    className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary"
                    value={card.dealId ?? ""}
                    onChange={(event) => {
                      const dealId = event.target.value;
                      if (!dealId || dealId === card.dealId) return;
                      void fetch("/api/sales/solar-workflow/lead", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ leadId: conversation.id, dealId }),
                      }).then(() => reload());
                    }}
                  >
                    {card.opportunities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </Section>

            {card.handoff && card.project ? (
              <Section title="Customer won">
                <p className="text-[13px] font-semibold text-sales-text-primary">{card.project.number}</p>
                <p className="mt-0.5 text-[12.5px] text-sales-text-secondary">{card.project.statusLabel}</p>
                <Link href={`/sales/projects/${card.project.id}`} className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-primary">
                  Open project
                </Link>
              </Section>
            ) : null}

            {card.stage === "WON" && !card.project ? (
              <Section title="Sale won">
                <p className="text-[13px] text-sales-text-secondary">
                  {card.wonValue != null ? formatCurrencyAmount(card.wonValue, card.currency) : "Sales is complete. Create a project to begin delivery."}
                </p>
              </Section>
            ) : null}

            <Requirement card={card} />
            {stillNeeded.length > 0 ? (
              <Section title="Still needed">
                <ul className="space-y-1 text-[12.5px] text-sales-text-secondary">
                  {stillNeeded.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title="Solar journey">
              <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px]" aria-label="Solar sales progress">
                {card.progress.map((step, index) => (
                  <li key={step.id} className="inline-flex items-center gap-1">
                    {index > 0 ? <span className="text-sales-text-muted" aria-hidden>→</span> : null}
                    <span
                      className={
                        step.state === "current"
                          ? "font-semibold text-sales-text-primary"
                          : step.state === "done"
                            ? "text-sales-text-secondary"
                            : "text-sales-text-muted"
                      }
                      aria-current={step.state === "current" ? "step" : undefined}
                    >
                      {step.label}
                    </span>
                  </li>
                ))}
                {card.stage === "LOST" ? <li className="font-semibold text-sales-danger">Lost</li> : null}
              </ol>
              {card.insight ? <p className="mt-2 text-[12.5px] leading-relaxed text-sales-text-secondary">{card.insight}</p> : null}
            </Section>

            <VisitBlock card={card} canModify={canModifyDeal} onSchedule={() => setScheduleOpen(true)} />
            <AssessmentBlock card={card} />
            <QuoteBlock
              card={card}
              canModify={canModifyDeal}
              busy={busy}
              onOpen={() => {
                setBusy(true);
                void openQuotation(false).finally(() => setBusy(false));
              }}
            />

            {card.installedSystem ? (
              <Section title="Existing system">
                <p className="text-[13px] font-semibold text-sales-text-primary">{card.installedSystem.headline}</p>
                {card.installedSystem.lines.map((line) => (
                  <p key={line} className="mt-0.5 text-[12.5px] text-sales-text-secondary">{line}</p>
                ))}
                {card.installedSystem.installedLabel ? (
                  <p className="mt-1 text-[12px] text-sales-text-muted">Installed {card.installedSystem.installedLabel}</p>
                ) : null}
                {card.dealName ? <p className="mt-2 text-[12px] text-sales-text-secondary">Current opportunity · {card.dealName}</p> : null}
                {card.installedSystem.projectId ? (
                  <Link href={`/sales/projects/${card.installedSystem.projectId}`} className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold">
                    View system
                  </Link>
                ) : null}
              </Section>
            ) : null}

            {plan && plan.activity.length > 0 ? (
              <Section title="Recent">
                <ul className="space-y-1 text-[12.5px] text-sales-text-secondary">
                  {plan.activity.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Section>
            ) : (
              <Context card={card} />
            )}

            {canTransfer || canReassign ? (
              <Section title="Ownership">
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => setTransferOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold">
                    <ArrowLeftRight size={14} /> Transfer conversation
                  </button>
                  <button type="button" onClick={() => setSupportOpen(true)} className="inline-flex min-h-11 items-center text-[13px] font-semibold">
                    Transfer to Support
                  </button>
                </div>
              </Section>
            ) : null}
          </>
        ) : null}
        {message ? (
          <div role="status" className="border-t border-sales-border-subtle px-4 py-3 text-[12px] font-semibold text-sales-text-label">
            {message}
          </div>
        ) : null}
      </div>

      {scheduleOpen && card ? (
        <ScheduleVisitDialog
          leadId={conversation.id}
          stage={card.stage}
          site={card.requirement.location ?? card.visit?.site ?? ""}
          staff={salespeople}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => {
            setScheduleOpen(false);
            void reload();
          }}
        />
      ) : null}
      {wonOpen && card?.dealId ? (
        <WonDialog
          dealId={card.dealId}
          hint={card.quotation?.total ?? card.wonValue}
          onClose={() => setWonOpen(false)}
          onSaved={() => {
            setWonOpen(false);
            void reload();
          }}
        />
      ) : null}
      {projectOpen && card?.dealId ? (
        <CreateFromDealDialog
          dealId={card.dealId}
          projectBasePath="/sales/projects"
          existingProjectId={card.projectId}
          owners={salespeople.map((person) => ({ id: person.id, name: person.name }))}
          onClose={() => {
            setProjectOpen(false);
            void reload();
          }}
        />
      ) : null}
      <TransferDialog
        open={transferOpen}
        salespeople={salespeople}
        currentAssigneeId={conversation.assignedToId}
        onClose={() => setTransferOpen(false)}
        onTransfer={async (assigneeId, handoverNotes) => {
          const response = await fetch(`/api/leads/${conversation.id}/transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assigned_to_id: assigneeId, handover_notes: handoverNotes || null }),
          });
          const json = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) throw new Error(json.error ?? "Transfer failed");
          onUpdated();
        }}
        whatsappMode
      />
      <TransferToSupportDialog
        open={supportOpen}
        salespeople={salespeople}
        currentUserId={userId}
        onClose={() => setSupportOpen(false)}
        onTransfer={async (payload) => {
          const response = await fetch(`/api/inbox/conversations/${conversation.id}/transfer-support`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) throw new Error(json.error ?? "Transfer failed");
          onUpdated();
        }}
      />
      {editingQuote ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center">
          <div className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-sales-border bg-sales-surface p-5 sm:rounded-xl">
            <QuotationBuilder
              quotation={editingQuote}
              clientId={clientId}
              leadPhone={conversation.phone}
              whatsappApiSend={conversation.source === "WHATSAPP_INBOUND"}
              onSaved={(quote) => setEditingQuote(quote)}
              onSent={() => {
                setEditingQuote(null);
                void reload();
              }}
              onClose={() => setEditingQuote(null)}
            />
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function EngagementBlock({
  plan,
  busy,
  canModifyDeal,
  reminderOpen,
  reminderDate,
  onReminderDate,
  onReminderOpen,
  onRun,
  onSchedule,
}: {
  plan: ReturnType<typeof resolveSolarEngagement>;
  busy: boolean;
  canModifyDeal: boolean;
  reminderOpen: boolean;
  reminderDate: string;
  onReminderDate: (value: string) => void;
  onReminderOpen: (value: boolean) => void;
  onRun: (action: SolarNextAction) => void;
  onSchedule: (date: Date) => void;
}) {
  const showPrimary = actionVisible(plan.primary, canModifyDeal);
  const showSecondary = actionVisible(plan.secondary, canModifyDeal);
  const choices = [
    { label: "Tomorrow", date: addDays(new Date(), 1) },
    { label: "2 days", date: addDays(new Date(), 2) },
    { label: "Friday", date: upcomingFriday(new Date()) },
  ];
  return (
    <div className="mt-3 border-t border-sales-border-subtle pt-3">
      {plan.engagementLabel ? (
        <div>
          <p className="text-[11px] font-semibold text-sales-text-label">Engagement</p>
          <p className="mt-0.5 text-[13px] font-semibold text-sales-text-primary">{plan.engagementLabel}</p>
          {plan.engagementDetail ? <p className="mt-0.5 text-[12px] text-sales-text-secondary">{plan.engagementDetail}</p> : null}
        </div>
      ) : null}
      {plan.primary.title || showPrimary || showSecondary || plan.contextLines.length > 0 || plan.scheduleFollowUp ? (
        <div className={plan.engagementLabel ? "mt-3" : ""}>
          <p className="text-[11px] font-semibold text-sales-text-label">Next action</p>
          {plan.contextLines.map((line) => (
            <p key={line} className="mt-0.5 text-[12.5px] text-sales-text-secondary">{line}</p>
          ))}
          {plan.primary.title ? <p className="mt-0.5 text-[13px] font-semibold text-sales-text-primary">{plan.primary.title}</p> : null}
          {showPrimary ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRun(plan.primary)}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[9px] bg-sales-brand px-3 py-2.5 text-[13px] font-semibold text-sales-brand-text disabled:opacity-50"
            >
              {busy ? "Working…" : plan.primary.button}
            </button>
          ) : null}
          {plan.scheduleFollowUp && canModifyDeal ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {choices.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  disabled={busy}
                  onClick={() => onSchedule(choice.date)}
                  className="inline-flex min-h-9 items-center rounded-full border border-sales-border px-3 text-[12px] font-semibold text-sales-text-primary disabled:opacity-50"
                >
                  {choice.label}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => onReminderOpen(!reminderOpen)}
                className="inline-flex min-h-9 items-center rounded-full border border-sales-border px-3 text-[12px] font-semibold text-sales-text-primary"
              >
                Custom
              </button>
            </div>
          ) : null}
          {reminderOpen && canModifyDeal ? (
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                value={reminderDate}
                onChange={(event) => onReminderDate(event.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-sales-border bg-sales-surface px-2.5 text-[13px]"
              />
              <button
                type="button"
                disabled={!reminderDate || busy}
                onClick={() => onSchedule(new Date(`${reminderDate}T10:00:00`))}
                className="min-h-11 rounded-[8px] bg-sales-brand px-3 text-[12px] font-semibold text-sales-brand-text disabled:opacity-50"
              >
                Save
              </button>
            </div>
          ) : null}
          {showSecondary && plan.secondary ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRun(plan.secondary!)}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-[9px] border border-sales-border px-3 py-2.5 text-[13px] font-semibold text-sales-text-primary disabled:opacity-50"
            >
              {plan.secondary.button}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function actionVisible(action: SolarNextAction | null, canModifyDeal: boolean): boolean {
  if (!action?.button) return false;
  if (action.kind === "open_visit" || action.kind === "continue_assessment" || action.kind === "open_project") return true;
  return canModifyDeal;
}

function upcomingFriday(now: Date): Date {
  const delta = (5 - now.getDay() + 7) % 7;
  return addDays(now, delta === 0 ? 7 : delta);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-sales-border-subtle px-3.5 py-3">
      <h3 className="text-[12px] font-semibold text-sales-text-label">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function Requirement({ card }: { card: Snapshot }) {
  const rows = [
    card.requirement.service ? { label: "Need", value: card.requirement.service } : null,
    card.requirement.location ? { label: "Location", value: card.requirement.location } : null,
    card.requirement.loads ? { label: "Backup for", value: card.requirement.loads } : null,
    card.requirement.timeline ? { label: "Timeline", value: card.requirement.timeline } : null,
    card.requirement.budget ? { label: "Budget", value: card.requirement.budget } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
  if (!rows.length) return null;
  return (
    <Section title="What we know">
      <dl className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[11px] text-sales-text-muted">{row.label}</dt>
            <dd className="text-[13px] text-sales-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function VisitBlock({ card, canModify, onSchedule }: { card: Snapshot; canModify: boolean; onSchedule: () => void }) {
  if (card.handoff) return null;
  const scheduled = card.visit && ["SCHEDULED", "ON_SITE", "RESCHEDULED"].includes(card.visit.status);
  const awaitingVisit = card.stage === "QUALIFIED" || card.stage === "SITE_VISIT_REQUIRED";
  if (!scheduled && !awaitingVisit) return null;
  return (
    <Section title="Site visit">
      {scheduled && card.visit ? (
        <>
          <p className="text-[13px] font-semibold text-sales-text-primary">{card.visit.scheduledAt ? format(new Date(card.visit.scheduledAt), "EEEE, HH:mm") : "Scheduled"}</p>
          {card.visit.site ? <p className="mt-0.5 text-[12.5px] text-sales-text-secondary">{card.visit.site}</p> : null}
          <p className="mt-2 text-[12px] text-sales-text-muted">Assigned</p>
          <p className="text-[13px] text-sales-text-primary">{card.visit.assigneeName || "Unassigned"}</p>
          <p className="mt-2 text-[12px] text-sales-text-muted">Status</p>
          <p className="text-[13px] text-sales-text-primary">{card.visit.statusLabel}</p>
          <Link href={`/sales/site-visits/${card.visit.id}`} className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold">
            Open visit
          </Link>
        </>
      ) : (
        <>
          <p className="text-[13px] text-sales-text-secondary">Site assessment has not been scheduled.</p>
          {canModify && card.nextActionKind !== "schedule_visit" && (card.stage === "QUALIFIED" || card.stage === "SITE_VISIT_REQUIRED") ? (
            <button type="button" onClick={onSchedule} className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold">
              Schedule site visit
            </button>
          ) : null}
        </>
      )}
    </Section>
  );
}

function AssessmentBlock({ card }: { card: Snapshot }) {
  if (card.assessment.status === "COMPLETED") {
    return (
      <Section title="Site assessment">
        <p className="text-[13px] text-sales-text-primary">
          Completed{card.assessment.completedAt ? ` · ${format(new Date(card.assessment.completedAt), "d MMM")}` : ""}
        </p>
        {card.assessment.outcome ? <Fact label="Outcome" value={card.assessment.outcome} /> : null}
        {card.assessment.power.length ? <Fact label="Power" value={card.assessment.power.join(" · ")} /> : null}
        {card.assessment.loads ? <Fact label="Essential loads" value={card.assessment.loads} /> : null}
        {card.assessment.roof ? <Fact label="Roof" value={card.assessment.roof} /> : null}
        {card.assessment.visitId ? (
          <Link href={`/sales/site-visits/${card.assessment.visitId}`} className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold">
            View full assessment
          </Link>
        ) : null}
      </Section>
    );
  }
  if (card.assessment.inProgress) {
    return (
      <Section title="Site assessment">
        <p className="text-[13px] text-sales-text-primary">In progress</p>
        <p className="mt-1 text-[12.5px] text-sales-text-secondary">
          Sections completed: {card.assessment.sectionsDone} / {card.assessment.sectionsTotal}
        </p>
        {card.assessment.visitId ? (
          <Link href={`/sales/site-visits/${card.assessment.visitId}`} className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold">
            Continue assessment
          </Link>
        ) : null}
      </Section>
    );
  }
  if (card.visit && !card.handoff && card.stage !== "NEW_LEAD" && card.stage !== "CONTACTED") {
    return (
      <Section title="Site assessment">
        <p className="text-[13px] text-sales-text-secondary">Site assessment has not been completed.</p>
      </Section>
    );
  }
  return null;
}

function QuoteBlock({
  card,
  canModify,
  busy,
  onOpen,
}: {
  card: Snapshot;
  canModify: boolean;
  busy: boolean;
  onOpen: () => void;
}) {
  if (card.quotation) {
    return (
      <Section title="Quotation">
        <p className="text-[13px] font-semibold text-sales-text-primary">{card.quotation.number || "Quotation"}</p>
        {card.quotation.total != null ? (
          <p className="mt-0.5 text-[13px] tabular-nums text-sales-text-primary">
            {formatCurrencyAmount(card.quotation.total, card.quotation.currency)}
          </p>
        ) : null}
        <p className="mt-1 text-[12.5px] text-sales-text-secondary">{card.quotation.statusLabel}</p>
        {card.quotation.sentAt && card.quotation.statusLabel !== "Accepted" ? (
          <p className="text-[12.5px] text-sales-text-secondary">Sent {formatDistanceToNow(new Date(card.quotation.sentAt), { addSuffix: true })}</p>
        ) : null}
        {card.quotation.acceptedAt ? (
          <p className="text-[12.5px] text-sales-text-secondary">Accepted {format(new Date(card.quotation.acceptedAt), "d MMM")}</p>
        ) : null}
        {canModify ? (
          <button type="button" disabled={busy} onClick={onOpen} className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold disabled:opacity-50">
            Open quote
          </button>
        ) : null}
      </Section>
    );
  }
  if (card.stage === "SITE_VISIT_COMPLETED" || card.stage === "PROPOSAL_PREPARED") {
    return (
      <Section title="Quotation">
        <p className="text-[13px] text-sales-text-secondary">No proposal has been prepared.</p>
      </Section>
    );
  }
  return null;
}

function Context({ card }: { card: Snapshot }) {
  const lines = [
    card.assessment.completedAt ? `Assessment completed ${format(new Date(card.assessment.completedAt), "d MMM")}` : null,
    card.quotation?.sentAt ? `Quotation sent ${format(new Date(card.quotation.sentAt), "d MMM")}` : null,
    card.quotation?.statusLabel === "Viewed" ? "Quotation viewed" : null,
    card.quotation?.acceptedAt ? `Quotation accepted ${format(new Date(card.quotation.acceptedAt), "d MMM")}` : null,
  ].filter((line): line is string => Boolean(line));
  if (!lines.length) return null;
  return (
    <Section title="Recent context">
      <ul className="space-y-1 text-[12.5px] text-sales-text-secondary">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 text-[12.5px]">
      <span className="text-sales-text-muted">{label}</span>
      <span className="mt-0.5 block text-sales-text-primary">{value}</span>
    </p>
  );
}

function SolarSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy aria-label="Loading solar opportunity">
      <div className="h-16 animate-pulse rounded-[10px] bg-sales-surface-hover" />
      <div className="h-20 animate-pulse rounded-[10px] bg-sales-surface-hover" />
      <div className="h-11 animate-pulse rounded-[10px] bg-sales-surface-hover" />
      <div className="h-24 animate-pulse rounded-[10px] bg-sales-surface-hover" />
    </div>
  );
}

function ScheduleVisitDialog({
  leadId,
  stage,
  site,
  staff,
  onClose,
  onSaved,
}: {
  leadId: string;
  stage: SolarSalesStage;
  site: string;
  staff: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [assignedToId, setAssignedToId] = useState(staff[0]?.id ?? "");
  const [address, setAddress] = useState(site);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!date || !assignedToId) {
      setError("Choose a date and who is going.");
      return;
    }
    setSaving(true);
    setError("");
    if (stage === "QUALIFIED") {
      const moved = await fetch("/api/sales/solar-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, target: "SITE_VISIT_REQUIRED" }),
      });
      if (!moved.ok) {
        const json = (await moved.json().catch(() => ({}))) as { error?: string };
        setSaving(false);
        setError(json.error || "Could not open a site visit.");
        return;
      }
    }
    const response = await fetch("/api/sales/site-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        startAt: new Date(`${date}T${time}`).toISOString(),
        durationMinutes: duration,
        assignedToId,
        siteAddress: address,
        notifyCustomer: false,
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(json.error || "Could not schedule the visit.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[16px] bg-sales-surface p-5 sm:rounded-[16px]">
        <h2 className="text-[1.15rem] font-semibold text-sales-text-primary">Schedule site visit</h2>
        <p className="mt-1 text-[13px] text-sales-text-secondary">This is a pre-sale visit. It stays with this WhatsApp conversation.</p>
        <label className="mt-4 block text-[12px] font-medium">Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3" />
        </label>
        <label className="mt-3 block text-[12px] font-medium">Time
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3" />
        </label>
        <label className="mt-3 block text-[12px] font-medium">Duration
          <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3">
            <option value={60}>1 hour</option>
            <option value={90}>90 minutes</option>
            <option value={120}>2 hours</option>
          </select>
        </label>
        <label className="mt-3 block text-[12px] font-medium">Assigned
          <select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3">
            {staff.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-[12px] font-medium">Site
          <input value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3" />
        </label>
        {error ? <p className="mt-3 text-[12.5px] text-sales-danger">{error}</p> : null}
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-4 min-h-11 w-full rounded-[10px] bg-sales-brand text-[14px] font-semibold text-sales-brand-text disabled:opacity-50">
          {saving ? "Scheduling…" : "Schedule site visit"}
        </button>
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
  hint: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(hint != null ? String(hint) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ close: { outcome: "WON", wonValue: Number(value) || 0 } }),
    });
    setSaving(false);
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setError(json.error || "Could not mark this won.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-[16px] bg-sales-surface p-5 sm:rounded-[16px]">
        <h2 className="text-[1.15rem] font-semibold">Mark deal won</h2>
        <label className="mt-3 block text-[12px] font-medium">Won value
          <input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-sales-border px-3" />
        </label>
        {error ? <p className="mt-3 text-[12.5px] text-sales-danger">{error}</p> : null}
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-4 min-h-11 w-full rounded-[10px] bg-sales-brand text-[14px] font-semibold text-sales-brand-text">
          Mark deal won
        </button>
        <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full text-[13px] font-semibold text-sales-text-secondary">Cancel</button>
      </div>
    </div>
  );
}
