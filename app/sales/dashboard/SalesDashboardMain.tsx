"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneMissed,
  PhoneCall,
  PhoneOff,
  CalendarClock,
  CheckCircle,
  XCircle,
  MinusCircle,
  Send,
  ChevronRight,
  Trophy,
  Activity,
  Users,
  X,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type PriorityLead = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string;
  score: number | null;
  is_stale: boolean | null;
  follow_up_date: string | null;
  followUpDue: boolean;
  priorityLabel: string;
  priorityColor: string;
  priorityOrder: number;
  client_id: string;
};

type ActivityEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
  lead_id: string;
  leads: { name: string | null }[] | null;
};

type RecentWin = {
  id: string;
  deal_value: number | null;
  days_to_close: number | null;
  created_at: string;
  leads: { name: string | null }[] | null;
};

type DashboardData = {
  priorityLeads: PriorityLead[];
  allActiveLeads: PriorityLead[];
  numbers: {
    totalActive: number;
    calledToday: number;
    followUpToday: number;
    wonThisMonth: number;
  };
  recentActivity: ActivityEvent[];
  recentWins: RecentWin[];
};

type Outcome =
  | "ANSWERED"
  | "NO_ANSWER"
  | "FOLLOW_UP"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

// ============================================
// CONSTANTS
// ============================================

const OUTCOMES: Array<{
  value: Outcome;
  label: string;
  icon: React.ElementType;
  colour: string;
}> = [
  { value: "ANSWERED", label: "Answered", icon: Phone, colour: "var(--success)" },
  { value: "NO_ANSWER", label: "No answer", icon: PhoneMissed, colour: "var(--text-tertiary)" },
  { value: "FOLLOW_UP", label: "Follow-up", icon: PhoneCall, colour: "var(--warning)" },
  { value: "WON", label: "Won", icon: CheckCircle, colour: "var(--accent)" },
  { value: "LOST", label: "Lost", icon: XCircle, colour: "var(--error)" },
  { value: "NOT_QUALIFIED", label: "Not qualified", icon: MinusCircle, colour: "var(--text-disabled)" },
];

// ============================================
// HELPERS
// ============================================

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatFollowUpDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === new Date(now.getTime() + 86400000).toDateString())
    return "Tomorrow";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatEventType(type: string, data: Record<string, unknown> | null): string {
  const d = data ?? {};
  const map: Record<string, (d: Record<string, unknown>) => string> = {
    CALL_LOGGED: (d) =>
      `Call — ${String(d.outcome ?? "").toLowerCase().replace(/_/g, " ")}`,
    DOCUMENT_SENT: (d) => `Sent ${String(d.document_name ?? "document")}`,
    STATUS_CHANGED: (d) =>
      `Moved to ${String(d.to_status ?? "").toLowerCase()}`,
    FOLLOW_UP_SET: () => "Follow-up scheduled",
  };
  return map[type]?.(d) ?? type.replace(/_/g, " ").toLowerCase();
}

// ============================================
// QUICK LOG SHEET
// ============================================

function QuickLogSheet({
  leads,
  preselectedLeadId,
  onClose,
  onSuccess,
}: {
  leads: PriorityLead[];
  preselectedLeadId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId);
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | "">("");
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleLog() {
    if (!selectedLeadId || !selectedOutcome) return;
    setLogging(true);
    try {
      const res = await fetch("/api/sales/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLeadId,
          outcome: selectedOutcome,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch {
      // silent — user can retry
    } finally {
      setLogging(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full rounded-t-2xl bg-[var(--surface-card)] border-t border-x border-[var(--border)]">
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-[var(--bg-quaternary)] mx-auto mt-3" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="font-display text-[18px] font-semibold text-[var(--text-primary)]">
            Log a call
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="px-5 py-5"
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center mb-3">
                <CheckCircle size={22} className="text-[var(--success)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--success)]">Call logged</p>
            </div>
          ) : (
            <>
              {/* Lead selector */}
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  Lead
                </p>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-[14px] focus:border-[var(--border-focus,var(--border-hover))] focus:outline-none transition-colors"
                >
                  <option value="">Select lead...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name ?? "Unknown"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Outcome grid */}
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  Outcome
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {OUTCOMES.map((outcome) => {
                    const isSelected = selectedOutcome === outcome.value;
                    return (
                      <button
                        key={outcome.value}
                        type="button"
                        onClick={() => setSelectedOutcome(outcome.value)}
                        className="h-11 rounded-lg border text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5"
                        style={{
                          background: isSelected
                            ? `color-mix(in srgb, ${outcome.colour} 15%, transparent)`
                            : undefined,
                          borderColor: isSelected
                            ? `color-mix(in srgb, ${outcome.colour} 40%, transparent)`
                            : "var(--border)",
                          color: isSelected ? outcome.colour : "var(--text-tertiary)",
                        }}
                      >
                        <outcome.icon size={13} />
                        {outcome.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  Notes{" "}
                  <span className="normal-case font-normal text-[var(--text-disabled)]">
                    optional
                  </span>
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What happened on the call..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-[14px] resize-none focus:border-[var(--border-focus,var(--border-hover))] focus:outline-none transition-colors placeholder:text-[var(--text-disabled)]"
                />
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={handleLog}
                disabled={!selectedLeadId || !selectedOutcome || logging}
                className={`w-full h-12 rounded-xl text-[15px] font-semibold transition-colors ${
                  !selectedLeadId || !selectedOutcome || logging
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-disabled)] cursor-not-allowed border border-[var(--border)]"
                    : "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
                }`}
              >
                {logging ? "Logging..." : "Log call"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function SalesDashboardMain({
  data,
  session,
}: {
  data: DashboardData;
  session: unknown;
}) {
  const router = useRouter();
  const s = session as { user?: { name?: string | null } } | null;
  const firstName = s?.user?.name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const [showLogSheet, setShowLogSheet] = useState(false);
  const [preselectedLeadId, setPreselectedLeadId] = useState("");

  function openLogSheet(leadId = "") {
    setPreselectedLeadId(leadId);
    setShowLogSheet(true);
  }

  function handleLogSuccess() {
    router.refresh();
  }

  return (
    <div>
      {/* ============================================
          HEADER
          ============================================ */}
      <div className="mb-8">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {today}
        </p>
        <h1 className="font-display text-3xl tracking-tight text-[var(--text-primary)]">
          Good {getGreeting()}, {firstName}
        </h1>
      </div>

      {/* ============================================
          NUMBERS STRIP — 4 compact stat cards
          ============================================ */}
      <div className="ag-fade-in grid grid-cols-2 min-[600px]:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: "Active leads",
            value: data.numbers.totalActive,
            colour: "var(--text-primary)",
            icon: Users,
          },
          {
            label: "Called today",
            value: data.numbers.calledToday,
            colour:
              data.numbers.calledToday > 0 ? "var(--success)" : "var(--text-disabled)",
            icon: Phone,
          },
          {
            label: "Follow-ups due",
            value: data.numbers.followUpToday,
            colour:
              data.numbers.followUpToday > 0 ? "var(--warning)" : "var(--text-disabled)",
            icon: CalendarClock,
          },
          {
            label: "Won this month",
            value: data.numbers.wonThisMonth,
            colour:
              data.numbers.wonThisMonth > 0 ? "var(--accent)" : "var(--text-disabled)",
            icon: Trophy,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 flex flex-col items-center"
          >
            <stat.icon size={14} className="mb-2 text-[var(--text-disabled)]" />
            <p
              className="font-display text-[32px] font-semibold leading-none mb-1"
              style={{ color: stat.colour }}
            >
              {stat.value}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] text-center">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ============================================
          PRIORITY LEAD LIST
          ============================================ */}
      <div className="ag-fade-in ag-delay-1 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
              Today
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Your priorities
            </h2>
          </div>
          <button
            type="button"
            onClick={() => router.push("/sales/leads")}
            className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
          >
            All leads
            <ChevronRight size={12} />
          </button>
        </div>

        {data.priorityLeads.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] flex flex-col items-center justify-center py-16 text-center px-5">
            <CheckCircle className="w-8 h-8 text-[var(--success)] mb-3" />
            <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
              All caught up
            </p>
            <p className="text-[13px] text-[var(--text-tertiary)]">
              No active leads assigned to you right now.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.priorityLeads.map((lead, index) => (
              <div
                key={lead.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden"
                style={{ animationDelay: `${0.05 + index * 0.04}s` }}
              >
                <div className="flex items-center gap-0">
                  {/* Priority colour bar */}
                  <div
                    className="w-1 self-stretch shrink-0"
                    style={{ background: lead.priorityColor }}
                  />

                  {/* Lead info */}
                  <div
                    className="flex-1 min-w-0 px-4 py-3 cursor-pointer"
                    onClick={() => router.push(`/sales/leads?lead=${lead.id}`)}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                        {lead.name ?? "Unknown"}
                      </p>
                      {/* Priority badge */}
                      <span
                        className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                        style={{
                          color: lead.priorityColor,
                          borderColor: `color-mix(in srgb, ${lead.priorityColor} 35%, transparent)`,
                          background: `color-mix(in srgb, ${lead.priorityColor} 12%, transparent)`,
                        }}
                      >
                        {lead.priorityLabel}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      {lead.status.charAt(0) + lead.status.slice(1).toLowerCase()}
                      {lead.follow_up_date && lead.followUpDue
                        ? " · Follow-up due today"
                        : lead.follow_up_date
                        ? ` · Follow-up ${formatFollowUpDate(lead.follow_up_date)}`
                        : " · No follow-up set"}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 px-3 shrink-0">
                    {/* Call */}
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-hover)] transition-colors"
                      >
                        <Phone size={15} className="text-[var(--success)]" />
                      </a>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center opacity-30">
                        <PhoneOff size={15} className="text-[var(--text-disabled)]" />
                      </div>
                    )}

                    {/* Log call */}
                    <button
                      type="button"
                      onClick={() => openLogSheet(lead.id)}
                      className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors text-[var(--text-secondary)]"
                    >
                      <Activity size={14} />
                    </button>

                    {/* Send */}
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/sales/leads?lead=${lead.id}&tab=send`)
                      }
                      className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors text-[var(--text-secondary)]"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================
          RECENT ACTIVITY + WINS — two columns on desktop
          ============================================ */}
      <div className="ag-fade-in ag-delay-2 grid grid-cols-1 gap-6 min-[900px]:grid-cols-2">

        {/* RECENT ACTIVITY */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
              History
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Your recent activity
            </h2>
          </div>

          {data.recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <Activity className="w-7 h-7 text-[var(--text-disabled)] mb-3" />
              <p className="text-[13px] text-[var(--text-tertiary)]">
                No activity logged yet today
              </p>
            </div>
          ) : (
            <div>
              {data.recentActivity.map((event, i) => {
                const Icon =
                  event.event_type === "CALL_LOGGED"
                    ? Phone
                    : event.event_type === "DOCUMENT_SENT"
                    ? Send
                    : event.event_type === "STATUS_CHANGED"
                    ? ChevronRight
                    : Activity;

                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 px-5 py-3 hover:bg-[var(--bg-tertiary)] transition-colors ${
                      i < data.recentActivity.length - 1
                        ? "border-b border-[var(--border)]"
                        : ""
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-quaternary)] border border-[var(--border)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={13} className="text-[var(--text-tertiary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--text-secondary)] leading-snug mb-0.5">
                        {formatEventType(event.event_type, event.event_data)}
                        {" — "}
                        <span className="text-[var(--text-primary)] font-semibold">
                          {event.leads?.[0]?.name ?? "Unknown"}
                        </span>
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {timeAgo(event.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* WINS THIS MONTH */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
              Deals
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Won this month
            </h2>
          </div>

          {data.recentWins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <Trophy className="w-7 h-7 text-[var(--text-disabled)] mb-3" />
              <p className="text-[13px] text-[var(--text-tertiary)]">
                No wins yet this month. Keep going.
              </p>
            </div>
          ) : (
            <div>
              {data.recentWins.map((win, i) => (
                <div
                  key={win.id}
                  className={`flex items-center justify-between gap-4 px-5 py-3 hover:bg-[var(--bg-tertiary)] transition-colors ${
                    i < data.recentWins.length - 1 ? "border-b border-[var(--border)]" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate mb-0.5">
                      {win.leads?.[0]?.name ?? "Unknown lead"}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      {win.days_to_close ?? 0}d to close
                      {" · "}
                      {timeAgo(win.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {win.deal_value ? (
                      <p className="text-[13px] font-semibold text-[var(--success)]">
                        ${Number(win.deal_value).toLocaleString()}
                      </p>
                    ) : (
                      <Trophy size={14} className="text-[var(--success)]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============================================
          FLOATING LOG CALL BUTTON
          ============================================ */}
      <button
        type="button"
        onClick={() => openLogSheet("")}
        className="fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center shadow-lg hover:bg-[var(--accent-hover)] transition-colors"
        style={{ boxShadow: "0 4px 16px rgba(212,255,79,0.25)" }}
        aria-label="Log a call"
      >
        <Phone size={22} />
      </button>

      {/* ============================================
          QUICK LOG SHEET
          ============================================ */}
      {showLogSheet && (
        <QuickLogSheet
          leads={data.allActiveLeads}
          preselectedLeadId={preselectedLeadId}
          onClose={() => setShowLogSheet(false)}
          onSuccess={handleLogSuccess}
        />
      )}
    </div>
  );
}
