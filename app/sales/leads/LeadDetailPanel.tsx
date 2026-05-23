"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { ChevronLeft, X } from "lucide-react";
import { useLeadPanel, closeLeadPanel } from "@/store/uiStore";
import type { LeadRow, LeadStatus } from "@/types";
import { MagicLinkButton } from "@/components/MagicLinkButton";
import { FormAnswersSection } from "@/components/leads/FormAnswersSection";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { SendAssetPanel } from "@/components/leads/SendAssetPanel";
import { HandoverBanner } from "@/components/leads/HandoverBanner";
import { LeadBriefing } from "@/components/leads/LeadBriefing";
import { StaleLeadRecovery } from "@/components/leads/StaleLeadRecovery";
import { ScoreBadge } from "@/components/ui/ScoreBadge";

type CallLogApiRow = {
  id: string;
  outcome: string;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  users: { name: string } | null;
};

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
  const { open, leadId } = useLeadPanel();
  const lead = leads.find((l) => l.id === leadId) ?? null;
  const { data: session } = useSession();
  const role = session?.role;
  const [logRefresh, setLogRefresh] = useState(0);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "timeline" | "send">("details");

  useEffect(() => {
    setActiveTab("details");
  }, [leadId]);

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

  const isReadOnly = readOnlyProp === true || role === "CLIENT_MANAGER";

  if (!open || !lead) return null;

  const activeLead = lead;
  const first = activeLead.name?.split(/\s+/)[0] ?? "Lead";
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
            {activeLead.name}
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
          {activeTab === "send" && !isReadOnly ? (
            <div className="p-4 sm:p-5">
              <SendAssetPanel
                leadId={activeLead.id}
                clientId={activeLead.client_id}
                leadPhone={activeLead.phone}
                onSent={() => {
                  setTimelineRefresh((k) => k + 1);
                  setActiveTab("timeline");
                }}
              />
            </div>
          ) : null}
          <div className={activeTab === "timeline" || activeTab === "send" ? "hidden" : ""}>
          <div className="space-y-3 p-4 max-md:pt-3 sm:p-5">
            <LeadBriefing leadId={activeLead.id} />
            <HandoverBanner leadId={activeLead.id} />
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
              <div
                style={{
                  padding: "14px 16px",
                  background: "var(--ag-surface)",
                  border: "0.5px solid var(--ag-border)",
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--ag-font-body)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ag-text-tertiary)",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Lead score
                  </p>
                  <ScoreBadge score={activeLead.score} />
                </div>
                <div
                  style={{
                    height: 4,
                    background: "var(--ag-surface-3)",
                    borderRadius: 2,
                    overflow: "hidden",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      width: `${activeLead.score}%`,
                      background:
                        activeLead.score >= 70
                          ? "#3dd68c"
                          : activeLead.score >= 40
                          ? "#f5a623"
                          : "#555555",
                      transition: "width 0.8s ease",
                    }}
                  />
                </div>
                {activeLead.score_breakdown && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 6,
                    }}
                  >
                    {Object.entries(activeLead.score_breakdown).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          style={{
                            textAlign: "center",
                            padding: "6px 4px",
                            background: "var(--ag-surface-2)",
                            borderRadius: 6,
                          }}
                        >
                          <p
                            style={{
                              fontFamily: "var(--ag-font-body)",
                              fontSize: 14,
                              fontWeight: 700,
                              color: "var(--ag-text-primary)",
                              margin: "0 0 2px",
                              lineHeight: 1,
                            }}
                          >
                            {value}
                          </p>
                          <p
                            style={{
                              fontFamily: "var(--ag-font-body)",
                              fontSize: 9,
                              color: "var(--ag-text-muted)",
                              margin: 0,
                              textTransform: "capitalize",
                              letterSpacing: "0.04em",
                            }}
                          >
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
              Source · {activeLead.source} · {format(new Date(activeLead.created_at), "MMM d, yyyy")}
            </div>
            <MagicLinkButton token={activeLead.magic_token} />
            {!isReadOnly ? (
              <a
                className="btn-primary flex min-h-12 w-full items-center justify-center touch-manipulation py-3.5 text-base sm:min-h-0 md:py-2 md:text-sm"
                href={`tel:${phone}`}
              >
                Call {first}
              </a>
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
          <FormAnswersSection
            className="max-md:px-4"
            formData={activeLead.form_data ?? {}}
            lead={activeLead}
            compactMobile
          />
          {(role === "SALESPERSON" || role === "AGENCY_ADMIN") && !isReadOnly ? (
            <>
              <div className="p-4 sm:p-5">
                <CallHistory leadId={activeLead.id} refreshKey={logRefresh} />
              </div>
              {!isClosed ? (
                <div className="p-4 sm:p-5">
                  <LogCallForm
                    leadId={activeLead.id}
                    onLogged={() => setLogRefresh((k) => k + 1)}
                    onLeadUpdated={onLeadUpdated}
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
                <CallHistoryOutcome outcome={log.outcome} notes={log.notes} />
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

function CallHistoryOutcome({ outcome, notes }: { outcome: string; notes: string | null }) {
  if (outcome === "LOST") {
    const n = notes?.trim() ?? "";
    let reasonPart = "";
    let extra: string | undefined;
    if (!n) {
      reasonPart = "";
    } else if (n.startsWith("Reason:")) {
      const m = n.match(/^Reason:\s*([^\n]+)(?:\n\n([\s\S]*))?$/);
      if (m?.[1]) {
        reasonPart = m[1].trim();
        extra = m[2]?.trim();
      } else {
        reasonPart = n;
      }
    } else {
      reasonPart = n;
    }
    return (
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="inline-flex h-[22px] shrink-0 items-center rounded-sm bg-[var(--status-lost-bg)] px-2.5 text-[11px] font-medium leading-none text-[var(--status-lost-fg)]">
            Lost
          </span>
          {reasonPart ? <span className="text-[13px] text-ink-primary">— {reasonPart}</span> : null}
        </div>
        {extra ? <p className="mt-1 text-[12px] text-ink-secondary">{extra}</p> : null}
      </div>
    );
  }

  const label = outcome.replaceAll("_", " ");
  return (
    <div className="min-w-0 flex-1">
      <span className="font-mono text-[11px] font-normal uppercase tracking-wide text-ink-secondary">{label}</span>
      {notes ? <p className="mt-1 text-[13px] text-ink-primary">{notes}</p> : null}
    </div>
  );
}
