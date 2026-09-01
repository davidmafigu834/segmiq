"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronLeft,
  CircleUserRound,
  ExternalLink,
  MoreVertical,
  Phone,
  Plus,
  Star,
  X,
} from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import Link from "next/link";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import {
  isWhatsAppInboundLead,
  whatsappInboxHref,
  whatsappLeadDisplayName,
  whatsappLeadSecondaryLine,
} from "@/lib/leads/whatsapp-lead-display";
import { isFacebookInstantFormLead } from "@/lib/leads/facebook-lead-display";
import { useLeadPanel, closeLeadPanel, type LeadPanelTab } from "@/store/uiStore";
import { useSalesMobileChrome } from "@/components/sales/navigation/SalesMobileChromeContext";
import type { DealRow, LeadRow } from "@/types";
import { MagicLinkButton } from "@/components/MagicLinkButton";
import { FormAnswersSection } from "@/components/leads/FormAnswersSection";
import { FacebookFormIntentSection } from "@/components/leads/FacebookFormIntentSection";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { SendAssetPanel } from "@/components/leads/SendAssetPanel";
import { QuotationsPanel } from "@/components/leads/QuotationsPanel";
import { HandoverBanner } from "@/components/leads/HandoverBanner";
import { LeadBriefing } from "@/components/leads/LeadBriefing";
import { DealValueEditor } from "@/components/leads/DealValueEditor";
import { LeadIntelligenceCard } from "@/components/leads/LeadIntelligenceCard";
import { StaleLeadRecovery } from "@/components/leads/StaleLeadRecovery";
import { DealReadinessCard } from "@/components/sales/deals/DealReadinessCard";
import { CreateDealSheet } from "@/components/sales/deals/CreateDealSheet";
import { ConfirmDialog, useSalesToast } from "@/components/sales/ui";
import { ConvertWonCustomerSheet } from "@/components/sales/leads/ConvertWonCustomerSheet";
import { getDealReadiness } from "@/lib/sales/deals/readiness";
import { formatLeadLifecycle, formatDealStage, isLeadConverted, isLeadOpenForQualification } from "@/lib/sales/deals/display";
import { formatCallLogHeadline } from "@/lib/call-log-display";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { ManagerReassignLeadButton } from "@/components/customer-hub/ManagerReassignLeadButton";
import { isActiveConvertLaterPick } from "@/lib/convert-later-picks";
import { timeAgo } from "@/lib/sales-priority-lead";
import {
  formatLeadIntent,
  intentLikelihoodCopy,
} from "@/lib/sales/pipeline-display";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { getDealCommercialValue } from "@/lib/sales/deals/commercial-value";

type CallLogApiRow = {
  id: string;
  outcome: string;
  reach_outcome: string | null;
  result: string | null;
  reason: string | null;
  callback_at: string | null;
  assets_requested: string[] | null;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  users: { name: string } | null;
};

type SendAssetType = "PORTFOLIO" | "PROJECT" | "PRICING_PACKAGE" | "TESTIMONIALS" | "DOCUMENT";

const TERMINAL: ReadonlySet<string> = new Set([
  "WON",
  "LOST",
  "NOT_QUALIFIED",
  "CONVERTED_TO_DEAL",
]);

export function LeadDetailPanel({
  leads,
  onLeadUpdated,
  onClose,
  readOnly: readOnlyProp,
}: {
  leads: LeadRow[];
  onLeadUpdated?: (lead: LeadRow) => void;
  onClose?: () => void;
  /** When true, hide salesperson actions (log call, reassign). Client managers default to read-only. */
  readOnly?: boolean;
}) {
  const { open, leadId, tab: panelTab } = useLeadPanel();
  const lead = leads.find((l) => l.id === leadId) ?? null;
  const { data: session } = useSession();
  const router = useRouter();
  const role = session?.role;
  const [logRefresh, setLogRefresh] = useState(0);
  const [businessType, setBusinessType] = useState<"trades" | "real_estate">("trades");
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<LeadPanelTab>("details");
  const [sendPreselect, setSendPreselect] = useState<SendAssetType[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [closingStatus, setClosingStatus] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [convertWonOpen, setConvertWonOpen] = useState(false);
  const [relatedDeal, setRelatedDeal] = useState<DealRow | null>(null);
  const { toast } = useSalesToast();
  const isMobileDrawer = useMediaQuery("(max-width: 767px)");
  const isBelowLayout = useMediaQuery("(max-width: 1099px)");
  const { setHideBottomNav } = useSalesMobileChrome();

  useEffect(() => {
    if (!open) return;
    setSendPreselect(null);
    setMoreOpen(false);
    setRelatedDeal(null);
    setActiveTab(panelTab ?? "details");
  }, [leadId, open, panelTab]);

  useLayoutEffect(() => {
    setPortalEl(document.body);
  }, []);

  useEffect(() => {
    const hide = Boolean(open && leadId && isBelowLayout);
    setHideBottomNav(hide);
    return () => setHideBottomNav(false);
  }, [open, leadId, isBelowLayout, setHideBottomNav]);

  useEffect(() => {
    if (!open || !lead || !isMobileDrawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, lead, isMobileDrawer]);

  useEffect(() => {
    if (!open || !lead?.client_id) return;
    let cancelled = false;
    fetch(`/api/clients/${lead.client_id}/website-integration`)
      .then((r) => r.json())
      .then((j: { business_type?: string }) => {
        if (!cancelled) {
          setBusinessType(j.business_type === "real_estate" ? "real_estate" : "trades");
        }
      })
      .catch(() => {
        if (!cancelled) setBusinessType("trades");
      });
    return () => {
      cancelled = true;
    };
  }, [open, lead?.id, lead?.client_id]);

  const alsoSells = session?.alsoSells;
  const canSell = canActAsSalesperson({ userId: session?.userId, role, alsoSells });
  const isReadOnly = readOnlyProp === true || (role === "CLIENT_MANAGER" && !alsoSells);
  const canQuote =
    role === "SALESPERSON" || role === "SUPER_ADMIN" || role === "CLIENT_MANAGER";

  if (!open || !lead) return null;

  const activeLead = lead;
  const isWhatsAppChat = isWhatsAppInboundLead(activeLead.source);
  const displayName = whatsappLeadDisplayName(activeLead);
  const isClosed = TERMINAL.has(activeLead.status);
  const converted = isLeadConverted(activeLead.status) || Boolean(activeLead.active_deal_id);
  const openForDeal = isLeadOpenForQualification(activeLead.status) || activeLead.status === "QUALIFIED";
  const dealReadiness = getDealReadiness({
    lead: activeLead,
    discovery: {
      interestConfirmed:
        activeLead.status === "CONTACTED" ||
        activeLead.status === "QUALIFIED" ||
        activeLead.status === "CONVERTED_TO_DEAL",
      nextStepAgreed: Boolean(activeLead.follow_up_date),
      valuePending: true,
    },
  });
  const phone = activeLead.phone?.trim() ?? "";
  const canRecordWonCustomer =
    canSell &&
    !isReadOnly &&
    activeLead.status !== "WON" &&
    activeLead.status !== "LOST" &&
    relatedDeal?.stage !== "WON";

  function handleClose() {
    closeLeadPanel();
    onClose?.();
  }

  async function handleCloseDeal(status: "NOT_QUALIFIED") {
    if (!onLeadUpdated || closingStatus) return;
    setClosingStatus(true);
    try {
      const res = await fetch(`/api/leads/${activeLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json().catch(() => ({}))) as { lead?: LeadRow };
      if (res.ok && json.lead) onLeadUpdated(json.lead);
    } finally {
      setClosingStatus(false);
    }
  }

  async function togglePick() {
    if (!onLeadUpdated || picking || isReadOnly) return;
    setPicking(true);
    const next = !isActiveConvertLaterPick(activeLead);
    try {
      const res = await fetch(`/api/leads/${activeLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_convert_later_pick: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { lead?: LeadRow };
      if (res.ok && json.lead) onLeadUpdated(json.lead);
    } finally {
      setPicking(false);
    }
  }

  function openWhatsAppAction() {
    if (isWhatsAppChat) return;
    try {
      window.localStorage.setItem(`log:channel:${activeLead.id}`, "whatsapp");
    } catch {
      /* ignore */
    }
    void openWhatsAppAndLog({
      leadId: activeLead.id,
      clientId: activeLead.client_id,
      leadName: activeLead.name,
      leadPhone: activeLead.phone,
      repName: session?.user?.name ?? "",
      formData: (activeLead.form_data as Record<string, unknown> | null) ?? null,
      tier: "neutral",
    });
  }

  function scrollToLogCall() {
    setActiveTab("details");
    window.requestAnimationFrame(() => {
      document.getElementById("log-call-form-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const isFacebook = isFacebookInstantFormLead(activeLead.source);
  const picked = isActiveConvertLaterPick(activeLead);
  const relative = timeAgo(activeLead.updated_at || activeLead.created_at);
  const subtitle = isWhatsAppChat
    ? `WhatsApp chat · ${relative}`
    : isFacebook
      ? `Facebook Instant Form · ${relative}`
      : `Lead details · ${relative}`;
  const intent = formatLeadIntent(activeLead.score);
  const score = activeLead.score;

  const tabClass = (active: boolean) =>
    `flex-1 border-b-2 px-3 py-3 text-center text-[13px] font-medium transition-colors duration-150 ${
      active
        ? "border-sales-brand text-sales-text-primary"
        : "border-transparent text-sales-text-secondary hover:text-sales-text-primary"
    }`;

  const qaBtn =
    "flex min-h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-[10px] border border-sales-border bg-sales-surface px-1 py-2 text-[11px] font-medium text-sales-text-secondary transition-colors duration-150 hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand disabled:opacity-40";

  const panel = (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-stretch md:items-stretch md:justify-end ${
        isMobileDrawer ? "" : "pointer-events-none"
      }`}
    >
      {isMobileDrawer ? (
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-black/40"
          aria-label="Close lead"
          onClick={handleClose}
        />
      ) : null}
      <div
        className="pipeline-drawer-light pointer-events-auto relative z-10 flex w-full min-w-0 max-w-full flex-col overflow-hidden border-sales-border bg-sales-surface text-sales-text-primary shadow-[0_8px_30px_rgba(16,24,40,0.08)] transition-transform duration-200 max-md:max-h-[min(96dvh,100dvh)] max-md:rounded-t-2xl max-md:pb-[env(safe-area-inset-bottom)] md:h-[100dvh] md:max-h-[100dvh] md:w-[520px] md:max-w-[min(100%,520px)] md:rounded-none md:border-l"
        role="dialog"
        aria-modal={isMobileDrawer}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="safe-top flex shrink-0 items-start gap-3 border-b border-sales-border bg-sales-surface px-4 pb-3 max-md:rounded-t-2xl md:px-5 md:pt-4"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center text-sales-text-secondary touch-manipulation md:hidden"
            onClick={handleClose}
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </button>

          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F8F9FB]">
            {isWhatsAppChat ? (
              <SiWhatsapp size={16} color="#25D366" aria-hidden />
            ) : isFacebook ? (
              <SiFacebook size={16} color="#1877F2" aria-hidden />
            ) : (
              <CircleUserRound size={16} strokeWidth={1.8} className="text-sales-text-secondary" aria-hidden />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-sales-text-primary md:text-[18px]">
              {displayName}
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {!isReadOnly && !isClosed ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-sales-text-muted transition-colors hover:bg-sales-surface-hover hover:text-[#F59E0B]"
                aria-label={picked ? `Remove ${displayName} from picks` : `Save ${displayName} to picks`}
                disabled={picking}
                onClick={() => void togglePick()}
              >
                <Star
                  size={16}
                  strokeWidth={1.8}
                  className={picked ? "text-[#F59E0B]" : undefined}
                  fill={picked ? "currentColor" : "none"}
                />
              </button>
            ) : null}
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-sales-text-secondary transition-colors hover:bg-sales-surface-hover"
                aria-label="More actions"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <MoreVertical size={16} strokeWidth={1.8} />
              </button>
              {moreOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close menu"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
                    {!isReadOnly ? (
                      <button
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-sales-surface-hover"
                        onClick={() => {
                          setMoreOpen(false);
                          scrollToLogCall();
                        }}
                      >
                        Log call
                      </button>
                    ) : null}
                    {canQuote ? (
                      <button
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-sales-surface-hover"
                        onClick={() => {
                          setMoreOpen(false);
                          setActiveTab("quote");
                        }}
                      >
                        Open quote
                      </button>
                    ) : null}
                    {!isReadOnly ? (
                      <button
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-sales-surface-hover"
                        onClick={() => {
                          setMoreOpen(false);
                          setActiveTab("send");
                        }}
                      >
                        Send assets
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-[8px] text-sales-text-secondary transition-colors hover:bg-sales-surface-hover md:inline-flex"
              onClick={handleClose}
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="sticky top-0 z-[1] flex shrink-0 border-b border-sales-border bg-sales-surface">
          <button type="button" onClick={() => setActiveTab("details")} className={tabClass(activeTab === "details")}>
            Details
          </button>
          <button type="button" onClick={() => setActiveTab("timeline")} className={tabClass(activeTab === "timeline")}>
            Timeline
          </button>
          {canQuote ? (
            <button type="button" onClick={() => setActiveTab("quote")} className={tabClass(activeTab === "quote")}>
              Quote
            </button>
          ) : null}
          {!isReadOnly ? (
            <button type="button" onClick={() => setActiveTab("send")} className={tabClass(activeTab === "send")}>
              Send
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 divide-y divide-sales-border overflow-y-auto overflow-x-hidden overscroll-y-contain pb-[max(1.25rem,env(safe-area-inset-bottom))] text-sm max-md:text-[15px] [touch-action:pan-y]">
          {activeTab === "timeline" ? <LeadTimeline key={timelineRefresh} leadId={activeLead.id} /> : null}
          {activeTab === "quote" && canQuote ? (
            <div className="p-4 sm:p-5">
              <QuotationsPanel
                leadId={activeLead.id}
                clientId={activeLead.client_id}
                leadPhone={activeLead.phone}
                dealId={activeLead.active_deal_id}
                onChanged={() => {
                  setTimelineRefresh((k) => k + 1);
                  if (onLeadUpdated) {
                    fetch(`/api/leads/${activeLead.id}`)
                      .then((r) => r.json())
                      .then((j: { lead?: LeadRow }) => {
                        if (j.lead) onLeadUpdated(j.lead);
                      })
                      .catch(() => {});
                  }
                }}
              />
            </div>
          ) : null}
          {activeTab === "send" && !isReadOnly ? (
            <div className="p-4 sm:p-5">
              <SendAssetPanel
                leadId={activeLead.id}
                clientId={activeLead.client_id}
                leadPhone={activeLead.phone}
                initialAssetTypes={sendPreselect ?? undefined}
                onClearPreselect={() => setSendPreselect(null)}
                onSent={() => {
                  setTimelineRefresh((k) => k + 1);
                  setActiveTab("timeline");
                  setSendPreselect(null);
                }}
              />
            </div>
          ) : null}

          <div className={activeTab !== "details" ? "hidden" : ""}>
            <div className="space-y-4 p-4 max-md:pt-3 sm:p-5">
              {score != null && Number.isFinite(score) ? (
                <div className="flex items-center gap-4 rounded-[12px] border border-sales-border bg-sales-surface-subtle px-4 py-3.5">
                  <div
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#2684FF ${Math.min(100, score)}%, var(--sales-border) 0)`,
                    }}
                    aria-label={`Lead score ${score}`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sales-surface text-[15px] font-semibold tabular-nums text-sales-text-primary">
                      {Math.round(score)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-sales-text-primary">{intentLikelihoodCopy(score)}</p>
                    <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                      {isWhatsAppChat
                        ? "Engaged via WhatsApp"
                        : isFacebook
                          ? "Engaged via Facebook"
                          : "Based on lead activity"}
                    </p>
                    {intent ? (
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-sales-text-secondary">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: intent.dot }}
                          aria-hidden
                        />
                        {intent.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {isWhatsAppChat ? (
                <div className="rounded-[12px] border border-[#D1FADF] bg-[#F6FEF9] p-4">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--success-fg,#027A48)]">
                    WhatsApp conversation
                  </p>
                  <p className="mb-3 text-[13px] leading-relaxed text-sales-text-secondary">
                    {whatsappLeadSecondaryLine(activeLead)}
                  </p>
                  <Link
                    href={whatsappInboxHref(activeLead.id)}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <SiWhatsapp size={16} aria-hidden />
                    Open in Sales Hub
                  </Link>
                </div>
              ) : null}

              <LeadBriefing leadId={activeLead.id} />
              <LeadIntelligenceCard
                leadId={activeLead.id}
                canReprocess={role === "SUPER_ADMIN" || role === "CLIENT_MANAGER"}
              />
              <HandoverBanner leadId={activeLead.id} />

              <div className="rounded-[12px] border border-sales-border bg-sales-surface p-3 text-[13px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  Lead lifecycle
                </p>
                <p className="mt-1 font-medium text-sales-text-primary">
                  {formatLeadLifecycle(activeLead.status)}
                </p>
              </div>

              {converted && (activeLead.active_deal_id || relatedDeal?.id) ? (
                <div className="rounded-[12px] border border-[rgba(212,255,79,0.45)] bg-[rgba(212,255,79,0.1)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                    Related Deal
                  </p>
                  {relatedDeal ? (
                    <>
                      <p className="mt-1 text-[14px] font-semibold text-sales-text-primary">
                        {relatedDeal.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                        {formatDealStage(relatedDeal.stage)} ·{" "}
                        {getDealCommercialValue(relatedDeal).display}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[13px] text-sales-text-secondary">
                      Deal created — open the commercial workspace to continue.
                    </p>
                  )}
                  <Link
                    href={`/sales/deals/${relatedDeal?.id ?? activeLead.active_deal_id}`}
                    className="mt-2 inline-flex min-h-[40px] items-center text-[13px] font-semibold text-sales-text-primary"
                  >
                    Open Deal
                  </Link>
                </div>
              ) : converted ? (
                <div className="rounded-[12px] border border-sales-border bg-sales-surface p-3 text-[13px] text-sales-text-secondary">
                  Deal created — acquisition history is preserved on this lead.
                </div>
              ) : openForDeal && !isReadOnly ? (
                <DealReadinessCard
                  readiness={dealReadiness}
                  onCreateDeal={() => setCreateDealOpen(true)}
                />
              ) : !converted && !isClosed ? (
                <p className="text-[13px] text-sales-text-secondary">
                  No Deal yet. Continue qualification to confirm whether there is a commercial
                  opportunity.
                </p>
              ) : null}

              <DealValueEditor
                lead={activeLead}
                disabled={isReadOnly || converted}
                onUpdated={onLeadUpdated}
              />
              {activeLead.is_stale ? (
                <StaleLeadRecovery
                  leadId={activeLead.id}
                  leadName={activeLead.name ?? "Lead"}
                  clientId={activeLead.client_id}
                  staleDays={Math.round(
                    (Date.now() -
                      new Date(activeLead.stale_since ?? activeLead.created_at).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}
                  assetsSentTypes={[]}
                  onSent={() => setTimelineRefresh((k) => k + 1)}
                />
              ) : null}

              {!isWhatsAppChat ? <FacebookFormIntentSection formData={activeLead.form_data} /> : null}

              <div className="space-y-1.5">
                {isReadOnly ? (
                  <div className="min-w-0 break-words text-[13px] text-sales-text-secondary">
                    {phone ? (
                      <>
                        Phone:{" "}
                        <a className="font-mono text-sales-text-primary underline-offset-2 hover:underline" href={`tel:${phone}`}>
                          {phone}
                        </a>
                      </>
                    ) : (
                      "No phone on file"
                    )}
                  </div>
                ) : phone ? (
                  <a className="block min-w-0 break-all font-mono text-[15px] text-[#2684FF] underline" href={`tel:${phone}`}>
                    {phone}
                  </a>
                ) : null}
                {activeLead.email ? (
                  <div className="min-w-0 break-all text-[13px] text-sales-text-secondary">{activeLead.email}</div>
                ) : null}
                <div className="text-[11px] uppercase tracking-wide text-sales-text-muted">
                  Source · {isWhatsAppChat ? "WhatsApp" : isFacebook ? "Facebook Instant Form" : activeLead.source} ·{" "}
                  {format(new Date(activeLead.created_at), "MMM d, yyyy")}
                </div>
                {!isWhatsAppChat ? <MagicLinkButton token={activeLead.magic_token} /> : null}
              </div>

              {!isReadOnly && (canRecordWonCustomer || (!isClosed && !converted)) ? (
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                    Qualification
                  </p>
                  {canRecordWonCustomer ? (
                    <>
                      <p className="mb-3 text-[13px] text-sales-text-secondary">
                        Closed on-site? Record the win and file them as a customer when you&apos;re back online.
                      </p>
                      <button
                        type="button"
                        className="mb-2 h-10 w-full rounded-[10px] border border-[rgba(160,210,30,0.55)] bg-[rgba(212,255,79,0.12)] text-[12px] font-semibold text-sales-text-primary"
                        onClick={() => setConvertWonOpen(true)}
                      >
                        Record won customer
                      </button>
                    </>
                  ) : (
                    <p className="mb-3 text-[13px] text-sales-text-secondary">
                      Commercial stages live on Deals. Use call outcomes and Create deal when ready.
                    </p>
                  )}
                  {!isClosed && !converted ? (
                    <button
                      type="button"
                      disabled={closingStatus}
                      className="h-10 w-full rounded-[10px] border border-sales-border bg-[var(--sales-neutral-100)] text-[12px] font-medium text-sales-text-secondary"
                      onClick={() => void handleCloseDeal("NOT_QUALIFIED")}
                    >
                      Mark not qualified
                    </button>
                  ) : null}
                </div>
              ) : null}

              {!isReadOnly ? (
                <div>
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                    Quick actions
                  </p>
                  <div className="flex gap-2">
                    {isWhatsAppChat ? (
                      <Link
                        href={whatsappInboxHref(activeLead.id)}
                        className={qaBtn}
                        aria-label={`Message ${displayName} on WhatsApp`}
                      >
                        <SiWhatsapp size={18} color="#25D366" aria-hidden />
                        WhatsApp
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={qaBtn}
                        disabled={!phone}
                        aria-label={`Message ${displayName} on WhatsApp`}
                        onClick={openWhatsAppAction}
                      >
                        <SiWhatsapp size={18} color="#25D366" aria-hidden />
                        WhatsApp
                      </button>
                    )}
                    {phone ? (
                      <a href={`tel:${phone}`} className={qaBtn} aria-label={`Call ${displayName}`}>
                        <Phone size={18} strokeWidth={1.8} aria-hidden />
                        Call
                      </a>
                    ) : (
                      <button type="button" className={qaBtn} disabled aria-label="No phone">
                        <Phone size={18} strokeWidth={1.8} aria-hidden />
                        Call
                      </button>
                    )}
                    <button
                      type="button"
                      className={qaBtn}
                      aria-label={`Log call for ${displayName}`}
                      onClick={scrollToLogCall}
                    >
                      <Plus size={18} strokeWidth={1.8} aria-hidden />
                      Log call
                    </button>
                    <button
                      type="button"
                      className={qaBtn}
                      aria-label="Send assets"
                      onClick={() => setActiveTab("send")}
                    >
                      <ExternalLink size={18} strokeWidth={1.8} aria-hidden />
                      Send assets
                    </button>
                    <button
                      type="button"
                      className={qaBtn}
                      aria-label="More actions"
                      onClick={() => setMoreOpen(true)}
                    >
                      <MoreVertical size={18} strokeWidth={1.8} aria-hidden />
                      More
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {role === "SALESPERSON" &&
            !isReadOnly &&
            !isClosed &&
            !converted ? (
              <div className="border-b border-sales-border p-4 max-md:px-4 sm:p-5 md:hidden">
                <button
                  type="button"
                  onClick={() => setCreateDealOpen(true)}
                  className="min-h-12 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-sm font-semibold text-sales-text-primary touch-manipulation"
                >
                  Create Deal
                </button>
              </div>
            ) : role === "SALESPERSON" &&
              !isReadOnly &&
              converted &&
              (activeLead.active_deal_id || relatedDeal?.id) ? (
              <div className="border-b border-sales-border p-4 max-md:px-4 sm:p-5 md:hidden">
                <Link
                  href={`/sales/deals/${relatedDeal?.id ?? activeLead.active_deal_id}`}
                  className="flex min-h-12 w-full items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface px-3 text-sm font-semibold text-sales-text-primary touch-manipulation"
                >
                  Open Deal
                </Link>
              </div>
            ) : null}

            {!isWhatsAppChat ? (
              <FormAnswersSection
                className="max-md:px-4"
                formData={activeLead.form_data ?? {}}
                lead={activeLead}
                compactMobile
                title={isFacebook ? "Form answers" : "Project details"}
              />
            ) : null}

            {(canSell || role === "SUPER_ADMIN") && !isReadOnly ? (
              <>
                <div className="p-4 sm:p-5">
                  <CallHistory leadId={activeLead.id} refreshKey={logRefresh} />
                </div>
                {!isClosed ? (
                  <div className="p-4 sm:p-5">
                    <div id="log-call-form-anchor" />
                    <LogCallForm
                      leadId={activeLead.id}
                      businessType={businessType}
                      clientId={activeLead.client_id}
                      contactId={activeLead.contact_id}
                      hasActiveDeal={Boolean(activeLead.active_deal_id)}
                      onLogged={() => setLogRefresh((k) => k + 1)}
                      onLeadUpdated={onLeadUpdated}
                      onQualifiedOpportunity={() => setCreateDealOpen(true)}
                      onOpenSendTab={(types) => {
                        setSendPreselect(types);
                        setActiveTab("send");
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-4 text-sm text-sales-text-secondary sm:p-5">
                    This lead is closed — call log is read-only.
                  </div>
                )}
              </>
            ) : null}

            {role === "SUPER_ADMIN" && !isReadOnly ? (
              <AgencyLeadAdminSection
                lead={activeLead}
                onLeadUpdated={onLeadUpdated}
                onAfterArchive={handleClose}
              />
            ) : null}

            {role === "CLIENT_MANAGER" || (role === "SUPER_ADMIN" && isReadOnly) ? (
              <div className="space-y-3 border-t border-sales-border p-4 sm:p-5 max-md:pb-6">
                <div className="font-mono text-[11px] uppercase text-sales-text-muted">Assignment</div>
                <p className="text-[13px] text-sales-text-secondary">
                  {activeLead.assigned_to_id
                    ? "Move this lead to another salesperson on your team."
                    : "Assign this lead to a salesperson on your team."}
                </p>
                <ManagerReassignLeadButton
                  clientId={activeLead.client_id}
                  leadId={activeLead.id}
                  currentAssigneeId={activeLead.assigned_to_id}
                  onReassigned={({ assigneeId }) => {
                    onLeadUpdated?.({
                      ...activeLead,
                      assigned_to_id: assigneeId,
                    });
                  }}
                />
              </div>
            ) : null}

            {isReadOnly ? (
              <div className="p-4 sm:p-5">
                <CallHistory leadId={activeLead.id} refreshKey={logRefresh} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (!portalEl) return null;
  return (
    <>
      {createPortal(panel, portalEl)}
      <CreateDealSheet
        lead={activeLead}
        open={createDealOpen}
        onClose={() => setCreateDealOpen(false)}
        onCreated={(deal: DealRow, meta) => {
          setRelatedDeal(deal);
          onLeadUpdated?.({
            ...activeLead,
            status: "CONVERTED_TO_DEAL",
            active_deal_id: deal.id,
            converted_at: new Date().toISOString(),
          });
          if (!meta?.alreadyExisted) {
            toast({
              tone: "success",
              title: "Deal created",
              description: `${deal.name} is now in your Pipeline.`,
            });
            router.refresh();
          }
        }}
      />
      <ConvertWonCustomerSheet
        lead={activeLead}
        open={convertWonOpen}
        onClose={() => setConvertWonOpen(false)}
        onSuccess={({ deal, lead: updatedLead }) => {
          setRelatedDeal(deal);
          onLeadUpdated?.(updatedLead);
          setLogRefresh((k) => k + 1);
          router.refresh();
        }}
      />
    </>
  );
}

function AgencyLeadAdminSection({
  lead,
  onLeadUpdated,
  onAfterArchive,
}: {
  lead: LeadRow;
  onLeadUpdated?: (lead: LeadRow) => void;
  onAfterArchive?: () => void;
}) {
  const [salespeople, setSalespeople] = useState<{ id: string; name: string }[]>([]);
  const [assigneeId, setAssigneeId] = useState(lead.assigned_to_id ?? "");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [busy, setBusy] = useState<"assign" | "archive" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setAssigneeId(lead.assigned_to_id ?? "");
  }, [lead.assigned_to_id, lead.id]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${lead.client_id}/users`)
      .then((r) => r.json())
      .then((d: { users?: { id: string; name: string }[] }) => {
        if (!cancelled) setSalespeople(d.users ?? []);
      })
      .catch(() => {
        if (!cancelled) setSalespeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.client_id]);

  const patchLead = useCallback(
    async (body: Record<string, unknown>) => {
      setMsg(null);
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; lead?: LeadRow };
      if (!res.ok) {
        setMsg(json.error ?? "Update failed");
        return null;
      }
      if (json.lead) {
        const row = json.lead as LeadRow;
        onLeadUpdated?.(row);
        return row;
      }
      return null;
    },
    [lead.id, onLeadUpdated]
  );

  async function handleReassign() {
    setBusy("assign");
    const nextId = assigneeId === "" ? null : assigneeId;
    await patchLead({
      assigned_to_id: nextId,
      handover_notes: handoverNotes.trim() || null,
    });
    setBusy(null);
  }

  async function handleArchive() {
    setArchiveError(null);
    setBusy("archive");
    const updated = await patchLead({ is_archived: true });
    setBusy(null);
    if (updated) {
      setArchiveOpen(false);
      onAfterArchive?.();
    } else {
      setArchiveError("Could not archive lead.");
    }
  }

  return (
    <div className="space-y-4 border-t border-sales-border p-4 sm:p-5 max-md:pb-6">
      <div className="font-mono text-[11px] uppercase text-sales-text-muted">Agency</div>
      {msg ? <p className="text-[13px] text-[var(--danger-fg,#B42318)]">{msg}</p> : null}
      <div>
        <label className="mb-1 block text-[12px] font-medium text-sales-text-secondary" htmlFor={`reassign-${lead.id}`}>
          Reassign to
        </label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
          <select
            id={`reassign-${lead.id}`}
            className="input-base min-h-11 w-full min-w-0 sm:h-9 sm:min-w-[200px] sm:flex-1"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {salespeople.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary min-h-11 w-full touch-manipulation px-3 text-[13px] sm:min-h-0 sm:h-9 sm:w-auto"
            disabled={busy !== null}
            onClick={() => void handleReassign()}
          >
            {busy === "assign" ? "Saving…" : "Apply"}
          </button>
        </div>
        <textarea
          className="mt-2 w-full rounded-md border border-sales-border bg-sales-surface px-3 py-2 text-[13px] text-sales-text-primary placeholder:text-sales-text-muted"
          rows={2}
          placeholder="Handover notes (optional) — visible in timeline"
          value={handoverNotes}
          onChange={(e) => setHandoverNotes(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="min-h-11 w-full text-left text-[13px] font-medium text-[var(--danger-fg,#B42318)] underline-offset-2 touch-manipulation hover:underline sm:min-h-0 sm:w-auto"
        disabled={busy !== null}
        onClick={() => {
          setArchiveError(null);
          setArchiveOpen(true);
        }}
      >
        Archive lead
      </button>
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={(open) => {
          if (!open && busy !== "archive") setArchiveOpen(false);
        }}
        title="Archive lead"
        description="It will be hidden from default lists. You can restore it later from archived views if your workspace supports them."
        confirmLabel="Archive"
        destructive
        loading={busy === "archive"}
        error={archiveError}
        onConfirm={() => void handleArchive()}
      />
    </div>
  );
}

function CallHistory({ leadId, refreshKey }: { leadId: string; refreshKey: number }) {
  const [logs, setLogs] = useState<CallLogApiRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLogs(null);
    setError(null);
    fetch(`/api/leads/${leadId}/call-logs`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<{ logs: CallLogApiRow[] }>;
      })
      .then((data) => {
        if (!cancelled) setLogs(data.logs ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load call history.");
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, refreshKey]);

  return (
    <div>
      <div className="font-mono text-[11px] uppercase text-sales-text-muted">Call history</div>
      {error ? <p className="mt-2 text-[13px] text-sales-text-secondary">{error}</p> : null}
      {!error && logs === null ? <p className="mt-2 text-[13px] text-sales-text-muted">Loading…</p> : null}
      {logs && logs.length === 0 ? <p className="mt-2 text-[13px] text-sales-text-muted">No calls logged yet.</p> : null}
      {logs && logs.length > 0 ? (
        <ul className="relative mt-3 list-none space-y-0 p-0">
          <div className="absolute bottom-0 left-[7px] top-2 border-l border-sales-border" aria-hidden />
          {logs.map((log) => (
            <li key={log.id} className="relative border-b border-sales-border py-3.5 pl-6 last:border-b-0">
              <span
                className={`absolute left-[7px] top-[22px] h-2 w-2 rounded-full ${
                  log.outcome === "LOST" ? "bg-sales-danger" : "bg-[var(--sales-neutral-400)]"
                }`}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3">
                <CallHistoryOutcome log={log} />
                <span className="shrink-0 font-mono text-[11px] text-sales-text-muted tabular-nums">
                  {format(new Date(log.created_at), "HH:mm")}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-sales-text-muted">{log.users?.name ?? "—"}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CallHistoryOutcome({ log }: { log: CallLogApiRow }) {
  const headline = formatCallLogHeadline(log);
  const isLost = log.outcome === "LOST" || log.result === "lost";

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-2">
        {isLost ? (
          <span className="inline-flex h-[22px] shrink-0 items-center rounded-md bg-sales-danger-soft px-2.5 text-[11px] font-medium leading-none text-[var(--danger-fg,#B42318)]">
            Lost
          </span>
        ) : null}
        <span
          className={
            isLost
              ? "text-[13px] text-sales-text-primary"
              : "font-mono text-[11px] font-normal uppercase tracking-wide text-sales-text-secondary"
          }
        >
          {isLost && log.reason ? `— ${log.reason}` : headline}
        </span>
      </div>
      {!isLost && log.notes ? <p className="mt-1 text-[13px] text-sales-text-primary">{log.notes}</p> : null}
      {isLost && log.notes ? <p className="mt-1 text-[12px] text-sales-text-secondary">{log.notes}</p> : null}
    </div>
  );
}
