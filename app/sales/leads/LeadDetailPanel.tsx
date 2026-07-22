"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { ChevronLeft, X, MessageCircle } from "lucide-react";
import Link from "next/link";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import {
  isWhatsAppInboundLead,
  whatsappInboxHref,
  whatsappLeadDisplayName,
  whatsappLeadSecondaryLine,
} from "@/lib/leads/whatsapp-lead-display";
import { useLeadPanel, closeLeadPanel, type LeadPanelTab } from "@/store/uiStore";
import type { LeadRow, LeadStatus } from "@/types";
import { MagicLinkButton } from "@/components/MagicLinkButton";
import { FormAnswersSection } from "@/components/leads/FormAnswersSection";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { SendAssetPanel } from "@/components/leads/SendAssetPanel";
import { QuotationsPanel } from "@/components/leads/QuotationsPanel";
import { HandoverBanner } from "@/components/leads/HandoverBanner";
import { LeadBriefing } from "@/components/leads/LeadBriefing";
import { DealValueEditor } from "@/components/leads/DealValueEditor";
import { LeadIntelligenceCard } from "@/components/leads/LeadIntelligenceCard";
import { StaleLeadRecovery } from "@/components/leads/StaleLeadRecovery";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { formatCallLogHeadline } from "@/lib/call-log-display";

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

const TERMINAL: ReadonlySet<string> = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

const MOVE_COLS = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"] as const satisfies readonly LeadStatus[];

type MoveColumn = (typeof MOVE_COLS)[number];

const COL_LABEL: Record<MoveColumn, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal sent",
};

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
  const role = session?.role;
  const [logRefresh, setLogRefresh] = useState(0);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<LeadPanelTab>("details");
  const [sendPreselect, setSendPreselect] = useState<SendAssetType[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setSendPreselect(null);
    setActiveTab(panelTab ?? "details");
  }, [leadId, open, panelTab]);

  useLayoutEffect(() => {
    setPortalEl(document.body);
  }, []);

  useEffect(() => {
    if (!open || !lead) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, lead]);

  const alsoSells = session?.alsoSells;
  const isReadOnly = readOnlyProp === true || (role === "CLIENT_MANAGER" && !alsoSells);
  // Quoting is allowed for salespeople, managers and agency admins (broader than
  // lead editing, which keeps managers read-only).
  const canQuote =
    role === "SALESPERSON" || role === "AGENCY_ADMIN" || role === "CLIENT_MANAGER";

  if (!open || !lead) return null;

  const activeLead = lead;
  const isWhatsAppChat = isWhatsAppInboundLead(activeLead.source);
  const displayName = whatsappLeadDisplayName(activeLead);
  const first = displayName.split(/\s+/)[0] ?? "Lead";
  const isClosed = TERMINAL.has(activeLead.status);
  const phone = activeLead.phone?.trim() ?? "";

  function handleClose() {
    closeLeadPanel();
    onClose?.();
  }

  async function handleMoveStage(next: MoveColumn) {
    if (!onLeadUpdated) return;
    const res = await fetch(`/api/leads/${activeLead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const json = (await res.json().catch(() => ({}))) as { lead?: LeadRow; error?: string };
    if (res.ok && json.lead) onLeadUpdated(json.lead);
  }

  const panel = (
    <div className="fixed inset-0 z-[60] flex items-end justify-stretch sm:items-end md:items-stretch md:justify-end">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-black/50"
        aria-label="Close lead"
        onClick={handleClose}
      />
      <div
        className="relative z-10 flex w-full min-w-0 max-w-full flex-col overflow-hidden bg-surface-card shadow-2xl max-md:max-h-[min(96dvh,100dvh)] max-md:rounded-t-2xl max-md:pb-[env(safe-area-inset-bottom)] md:max-h-[100dvh] md:h-[100dvh] md:max-w-[min(100%,520px)] md:rounded-none md:border-l md:border-t-0 md:border-border md:shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="safe-top flex h-12 min-h-12 shrink-0 items-center gap-3 border-b border-border border-opacity-20 bg-surface-sidebar px-4 text-[var(--text-on-dark)] max-md:rounded-t-2xl md:min-h-0 md:px-5"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center text-[var(--text-on-dark)] touch-manipulation md:hidden"
            onClick={handleClose}
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <div className="min-w-0 flex-1 truncate font-display text-[17px] leading-tight sm:text-lg md:text-xl">
            {displayName}
            {isWhatsAppChat ? (
              <span className="mt-0.5 block truncate font-sans text-[11px] font-normal text-[var(--text-on-dark-dim)]">
                WhatsApp chat
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center text-[var(--text-on-dark-dim)] touch-manipulation hover:text-[var(--text-on-dark)] md:flex"
            onClick={handleClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`flex-1 border-b-2 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-wide transition-colors ${
              activeTab === "details"
                ? "border-[var(--info)] text-ink-primary"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`flex-1 border-b-2 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-wide transition-colors ${
              activeTab === "timeline"
                ? "border-[var(--info)] text-ink-primary"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Timeline
          </button>
          {canQuote ? (
            <button
              type="button"
              onClick={() => setActiveTab("quote")}
              className={`flex-1 border-b-2 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-wide transition-colors ${
                activeTab === "quote"
                  ? "border-[var(--info)] text-ink-primary"
                  : "border-transparent text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Quote
            </button>
          ) : null}
          {!isReadOnly ? (
            <button
              type="button"
              onClick={() => setActiveTab("send")}
              className={`flex-1 border-b-2 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-wide transition-colors ${
                activeTab === "send"
                  ? "border-[var(--info)] text-ink-primary"
                  : "border-transparent text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Send
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overflow-x-hidden overscroll-y-contain pb-[max(1.25rem,env(safe-area-inset-bottom))] text-sm max-md:text-[15px] [touch-action:pan-y]">
          {activeTab === "timeline" ? (
            <LeadTimeline key={timelineRefresh} leadId={activeLead.id} />
          ) : null}
          {activeTab === "quote" && canQuote ? (
            <div className="p-4 sm:p-5">
              <QuotationsPanel
                leadId={activeLead.id}
                clientId={activeLead.client_id}
                leadPhone={activeLead.phone}
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
          <div className="space-y-3 p-4 max-md:pt-3 sm:p-5">
            {isWhatsAppChat ? (
              <div className="rounded-lg border border-[var(--channel-whatsapp-muted)] bg-[var(--channel-whatsapp-muted)] p-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--channel-whatsapp)]">
                  <MessageCircle size={14} />
                  WhatsApp conversation
                </div>
                <p className="mb-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                  {whatsappLeadSecondaryLine(activeLead)}
                </p>
                <Link
                  href={whatsappInboxHref(activeLead.id)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--channel-whatsapp)] px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
                >
                  <MessageCircle size={16} />
                  Open in Sales Hub
                </Link>
              </div>
            ) : null}
            <LeadBriefing leadId={activeLead.id} />
            <LeadIntelligenceCard
              leadId={activeLead.id}
              canReprocess={
                role === "AGENCY_ADMIN" || role === "CLIENT_MANAGER"
              }
            />
            <HandoverBanner leadId={activeLead.id} />
            <DealValueEditor
              lead={activeLead}
              disabled={isReadOnly}
              onUpdated={onLeadUpdated}
            />
            {activeLead.is_stale && (
              <StaleLeadRecovery
                leadId={activeLead.id}
                leadName={activeLead.name ?? "Lead"}
                clientId={activeLead.client_id}
                staleDays={Math.round(
                  (Date.now() -
                    new Date(
                      activeLead.stale_since ?? activeLead.created_at
                    ).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}
                assetsSentTypes={[]}
                onSent={() => setTimelineRefresh((k) => k + 1)}
              />
            )}
            {activeLead.score !== null && activeLead.score !== undefined && (
              <div className="mb-4 rounded-xl border border-border bg-surface-card-alt px-4 py-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
                    Lead score
                  </p>
                  <ScoreBadge score={activeLead.score} />
                </div>
                <div className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
                  <div
                    className="h-1 rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      width: `${activeLead.score}%`,
                      background:
                        activeLead.score >= 70
                          ? "var(--success)"
                          : activeLead.score >= 40
                          ? "var(--warning)"
                          : "var(--text-tertiary)",
                    }}
                  />
                </div>
                {activeLead.score_breakdown && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.entries(activeLead.score_breakdown).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="rounded-md bg-[var(--bg-tertiary)] px-1 py-1.5 text-center"
                        >
                          <p className="mb-0.5 text-sm font-bold leading-none text-ink-primary">
                            {value}
                          </p>
                          <p className="text-[9px] capitalize tracking-[0.04em] text-ink-tertiary">
                            {key.replace(/_/g, " ")}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
            {isReadOnly ? (
              <div className="min-w-0 break-words text-[13px] text-ink-secondary">
                {phone ? (
                  <>
                    Phone:{" "}
                    <a className="font-mono text-ink-primary underline-offset-2 hover:underline" href={`tel:${phone}`}>
                      {phone}
                    </a>
                  </>
                ) : (
                  "No phone on file"
                )}
              </div>
            ) : (
              <a className="block min-w-0 break-all font-mono text-lg text-[var(--info)] underline" href={`tel:${phone}`}>
                {activeLead.phone}
              </a>
            )}
            <div className="min-w-0 break-all text-ink-secondary">{activeLead.email}</div>
            <div className="break-words font-mono text-[11px] uppercase text-ink-tertiary">
              Source · {isWhatsAppChat ? "WhatsApp chat" : activeLead.source} · {format(new Date(activeLead.created_at), "MMM d, yyyy")}
            </div>
            {!isWhatsAppChat ? <MagicLinkButton token={activeLead.magic_token} /> : null}
            {!isReadOnly ? (
              <div className="flex flex-col sm:flex-row w-full gap-2">
                <a
                  className="btn-primary flex min-h-12 flex-1 items-center justify-center touch-manipulation py-3.5 text-base sm:min-h-0 md:py-2 md:text-sm"
                  href={`tel:${phone}`}
                >
                  Call {first}
                </a>
                {isWhatsAppChat ? (
                  <Link
                    href={whatsappInboxHref(activeLead.id)}
                    className="btn-secondary-dark flex min-h-12 flex-1 items-center justify-center gap-2 touch-manipulation py-3.5 text-base sm:min-h-0 md:py-2 md:text-sm"
                  >
                    <MessageCircle size={16} /> Open in Sales Hub
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary-dark flex min-h-12 flex-1 items-center justify-center touch-manipulation py-3.5 text-base sm:min-h-0 md:py-2 md:text-sm"
                    onClick={() => {
                      try {
                        window.localStorage.setItem(`log:channel:${activeLead.id}`, "whatsapp");
                      } catch {}
                      openWhatsAppAndLog({
                        leadId: activeLead.id,
                        clientId: activeLead.client_id,
                        leadName: activeLead.name,
                        leadPhone: activeLead.phone,
                        repName: session?.user?.name ?? "",
                        formData: (activeLead.form_data as Record<string, unknown> | null) ?? null,
                        tier: "neutral",
                      });
                    }}
                  >
                    <MessageCircle size={16} /> Message on WhatsApp
                  </button>
                )}
              </div>
            ) : null}
          </div>
          {role === "SALESPERSON" &&
          !isReadOnly &&
          !isClosed &&
          (MOVE_COLS as readonly string[]).includes(activeLead.status) ? (
            <div className="border-b border-border p-4 max-md:px-4 sm:p-5 md:hidden">
              <label className="mb-2 block font-mono text-xs uppercase tracking-wide text-ink-tertiary">
                Move to
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MOVE_COLS.filter((c) => c !== activeLead.status).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => void handleMoveStage(col)}
                    className="min-h-12 rounded-md border border-border px-2 text-left text-sm text-ink-primary touch-manipulation hover:bg-surface-card-alt sm:min-h-0 sm:h-9 sm:py-0"
                  >
                    → {COL_LABEL[col]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {!isWhatsAppChat ? (
            <FormAnswersSection
              className="max-md:px-4"
              formData={activeLead.form_data ?? {}}
              lead={activeLead}
              compactMobile
            />
          ) : null}
          {(role === "SALESPERSON" || role === "AGENCY_ADMIN") && !isReadOnly ? (
            <>
              <div className="p-4 sm:p-5">
                <CallHistory leadId={activeLead.id} refreshKey={logRefresh} />
              </div>
              {!isClosed ? (
                <div className="p-4 sm:p-5">
                  <div id="log-call-form-anchor" />
                  <LogCallForm
                    leadId={activeLead.id}
                    onLogged={() => setLogRefresh((k) => k + 1)}
                    onLeadUpdated={onLeadUpdated}
                    onOpenSendTab={(types) => {
                      setSendPreselect(types);
                      setActiveTab("send");
                    }}
                  />
                </div>
              ) : (
                <div className="p-4 sm:p-5 text-sm text-ink-secondary">This lead is closed — call log is read-only.</div>
              )}
            </>
          ) : null}
          {role === "AGENCY_ADMIN" && !isReadOnly ? (
            <AgencyLeadAdminSection lead={activeLead} onLeadUpdated={onLeadUpdated} onAfterArchive={handleClose} />
          ) : null}
          {isReadOnly ? (
            <div className="p-4 sm:p-5">
              <CallHistory leadId={activeLead.id} refreshKey={logRefresh} />
            </div>
          ) : null}
          </div>{/* end details tab wrapper */}
        </div>
      </div>
    </div>
  );

  if (!portalEl) return null;
  return createPortal(panel, portalEl);
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
    if (!window.confirm("Archive this lead? It will be hidden from default lists.")) return;
    setBusy("archive");
    const updated = await patchLead({ is_archived: true });
    setBusy(null);
    if (updated) onAfterArchive?.();
  }

  return (
    <div className="space-y-4 border-t border-border p-4 sm:p-5 max-md:pb-6">
      <div className="font-mono text-[11px] uppercase text-ink-tertiary">Agency</div>
      {msg ? <p className="text-[13px] text-[var(--status-lost-fg)]">{msg}</p> : null}
      <div>
        <label className="mb-1 block text-[12px] font-medium text-ink-secondary" htmlFor={`reassign-${lead.id}`}>
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
          className="mt-2 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-tertiary"
          rows={2}
          placeholder="Handover notes (optional) — visible in timeline"
          value={handoverNotes}
          onChange={(e) => setHandoverNotes(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="min-h-11 w-full text-left text-[13px] font-medium text-[var(--status-lost-fg)] underline-offset-2 touch-manipulation hover:underline sm:min-h-0 sm:w-auto"
        disabled={busy !== null}
        onClick={() => void handleArchive()}
      >
        {busy === "archive" ? "Archiving…" : "Archive lead"}
      </button>
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
      <div className="font-mono text-[11px] uppercase text-ink-tertiary">Call history</div>
      {error ? <p className="mt-2 text-[13px] text-ink-secondary">{error}</p> : null}
      {!error && logs === null ? <p className="mt-2 text-[13px] text-ink-tertiary">Loading…</p> : null}
      {logs && logs.length === 0 ? <p className="mt-2 text-[13px] text-ink-tertiary">No calls logged yet.</p> : null}
      {logs && logs.length > 0 ? (
        <ul className="relative mt-3 list-none space-y-0 p-0">
          <div className="absolute bottom-0 left-[7px] top-2 border-l border-border" aria-hidden />
          {logs.map((log) => (
            <li key={log.id} className="relative border-b border-border py-3.5 pl-6 last:border-b-0">
              <span
                className={`absolute left-[7px] top-[22px] h-2 w-2 rounded-full ${
                  log.outcome === "LOST" ? "bg-[var(--status-lost-fg)]" : "bg-ink-tertiary"
                }`}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3">
                <CallHistoryOutcome log={log} />
                <span className="shrink-0 font-mono text-[11px] text-ink-tertiary tabular-nums">
                  {format(new Date(log.created_at), "HH:mm")}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-ink-tertiary">{log.users?.name ?? "—"}</p>
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
          <span className="inline-flex h-[22px] shrink-0 items-center rounded-md bg-[var(--status-lost-bg)] px-2.5 text-[11px] font-medium leading-none text-[var(--status-lost-fg)]">
            Lost
          </span>
        ) : null}
        <span
          className={
            isLost
              ? "text-[13px] text-ink-primary"
              : "font-mono text-[11px] font-normal uppercase tracking-wide text-ink-secondary"
          }
        >
          {isLost && log.reason ? `— ${log.reason}` : headline}
        </span>
      </div>
      {!isLost && log.notes ? (
        <p className="mt-1 text-[13px] text-ink-primary">{log.notes}</p>
      ) : null}
      {isLost && log.notes ? (
        <p className="mt-1 text-[12px] text-ink-secondary">{log.notes}</p>
      ) : null}
    </div>
  );
}
