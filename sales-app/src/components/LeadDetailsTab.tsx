import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ClipboardList,
  Copy,
  Link2,
  Loader2,
  Mail,
  Phone,
  Sparkles,
} from "lucide-react";
import { apiGet, apiPatch, API_BASE } from "../lib/api";
import { formatCallLogHeadline } from "../lib/call-log-display";
import { formatFormData } from "../lib/format-form-data";
import {
  formatFollowUpDate,
  scoreHeat,
  statusLabel,
  STATUS_TONE_CLASSES,
  statusTone,
  timeAgo,
} from "../lib/format";
import type { LeadRow, LeadStatus } from "../lib/types";
import { CrmButton } from "./crm";
import { LogCallForm } from "./LogCallForm";

const STRUCTURED_LABELS = new Set([
  "name",
  "full name",
  "full_name",
  "phone",
  "phone number",
  "phone_number",
  "mobile",
  "contact number",
  "email",
  "email address",
]);

const MOVE_COLS: LeadStatus[] = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"];
const COL_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal sent",
};

type CallLogApiRow = {
  id: string;
  outcome: string;
  reach_outcome: string | null;
  result: string | null;
  reason: string | null;
  callback_at: string | null;
  notes: string | null;
  created_at: string;
  users: { name: string } | null;
};

type Props = {
  lead: LeadRow;
  online: boolean;
  logRefreshKey: number;
  onLeadUpdated: (lead: LeadRow) => void;
  onLogCall?: () => void;
  onOpenSendTab?: () => void;
};

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-tertiary text-accent">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">{title}</p>
        {subtitle ? <p className="mt-0.5 text-[13px] text-ink-secondary">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function StatusCard({ lead }: { lead: LeadRow }) {
  const tone = statusTone(lead.status);
  const styles = STATUS_TONE_CLASSES[tone];
  const isClosed = ["WON", "LOST", "NOT_QUALIFIED"].includes(lead.status);

  return (
    <div className={`rounded-2xl border bg-surface-card p-4 ring-1 ${styles.ring}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} aria-hidden />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">Pipeline status</p>
            <p className="mt-0.5 text-[20px] font-semibold leading-tight text-ink-primary">
              {statusLabel(lead.status)}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${styles.badge}`}
        >
          {isClosed ? "Closed" : "Active"}
        </span>
      </div>
      {lead.follow_up_date ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-bg-tertiary px-3 py-2.5">
          <Calendar size={14} className="shrink-0 text-accent" />
          <p className="text-[13px] text-ink-secondary">
            Follow-up <span className="font-medium text-ink-primary">{formatFollowUpDate(lead.follow_up_date)}</span>
          </p>
        </div>
      ) : null}
      {lead.manual_priority ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
          Priority · <span className="capitalize text-ink-secondary">{lead.manual_priority}</span>
        </p>
      ) : null}
    </div>
  );
}

function ContactCard({
  type,
  value,
  href,
}: {
  type: "phone" | "email";
  value: string | null | undefined;
  href?: string;
}) {
  const Icon = type === "phone" ? Phone : Mail;
  const label = type === "phone" ? "Phone" : "Email";
  const accentClass = type === "phone" ? "text-[var(--success)]" : "text-accent";
  const iconBg = type === "phone" ? "bg-[rgba(61,214,140,0.12)]" : "bg-accent-muted";
  const iconColor = type === "phone" ? "text-[var(--success)]" : "text-accent";

  const inner = (
    <div className="flex items-center gap-3">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">{label}</p>
        {value ? (
          <p className={`truncate text-[17px] font-medium ${type === "phone" ? "font-mono " + accentClass : "text-ink-primary"}`}>
            {value}
          </p>
        ) : (
          <p className="text-[15px] text-ink-tertiary">Not on file</p>
        )}
      </div>
      {value && href ? (
        <span className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium text-ink-secondary">
          Tap to {type === "phone" ? "call" : "email"}
        </span>
      ) : null}
    </div>
  );

  if (value && href) {
    return (
      <a
        href={href}
        className="block rounded-2xl border border-border bg-surface-card p-4 transition-colors active:bg-bg-tertiary"
      >
        {inner}
      </a>
    );
  }

  return <div className="rounded-2xl border border-border bg-surface-card p-4">{inner}</div>;
}

function MetaCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card divide-y divide-border">
      {children}
    </div>
  );
}

function MetaRow({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      {icon ? <span className="mt-0.5 shrink-0 text-ink-tertiary">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">{label}</p>
        <div className="mt-0.5 text-[14px] text-ink-primary">{value}</div>
      </div>
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
          <span className="inline-flex h-[22px] shrink-0 items-center rounded-md bg-[rgba(255,68,68,0.12)] px-2.5 text-[11px] font-medium leading-none text-[var(--error)]">
            Lost
          </span>
        ) : null}
        <span
          className={
            isLost
              ? "text-[14px] text-ink-primary"
              : "font-mono text-[11px] font-normal uppercase tracking-wide text-ink-secondary"
          }
        >
          {isLost && log.reason ? `— ${log.reason}` : headline}
        </span>
      </div>
      {!isLost && log.notes ? (
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-primary">{log.notes}</p>
      ) : null}
      {isLost && log.notes ? (
        <p className="mt-1.5 text-[13px] text-ink-secondary">{log.notes}</p>
      ) : null}
    </div>
  );
}

export function LeadDetailsTab({
  lead,
  online,
  logRefreshKey,
  onLeadUpdated,
  onLogCall,
  onOpenSendTab,
}: Props) {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [logs, setLogs] = useState<CallLogApiRow[] | null>(null);
  const [logsError, setLogsError] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isClosed = ["WON", "LOST", "NOT_QUALIFIED"].includes(lead.status);
  const heat = scoreHeat(lead.score);

  const loadBriefing = useCallback(async () => {
    setBriefingLoading(true);
    try {
      const res = await apiGet<{ briefing?: string; suggestion?: string }>(
        `/api/leads/${lead.id}/briefing`
      );
      if (res.ok) {
        setBriefing(res.data.briefing ?? null);
        setSuggestion(res.data.suggestion ?? null);
      } else {
        setBriefing(null);
        setSuggestion(null);
      }
    } catch {
      setBriefing(null);
      setSuggestion(null);
    } finally {
      setBriefingLoading(false);
    }
  }, [lead.id]);

  const loadLogs = useCallback(async () => {
    setLogsError("");
    try {
      const res = await apiGet<{ logs?: CallLogApiRow[] }>(`/api/leads/${lead.id}/call-logs`);
      if (!res.ok) throw new Error("Failed");
      setLogs(res.data.logs ?? []);
    } catch {
      setLogs(null);
      setLogsError("Could not load call history.");
    }
  }, [lead.id]);

  useEffect(() => {
    void loadBriefing();
  }, [loadBriefing]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, logRefreshKey]);

  const formEntries = formatFormData(lead.form_data).filter(
    (e) => !STRUCTURED_LABELS.has(e.label.toLowerCase().trim())
  );
  if (lead.budget && !formEntries.some((e) => e.label.toLowerCase().includes("budget"))) {
    formEntries.unshift({ label: "Budget", value: lead.budget });
  }
  if (lead.project_type && !formEntries.some((e) => e.label.toLowerCase().includes("project"))) {
    formEntries.unshift({ label: "Project type", value: lead.project_type });
  }
  if (lead.timeline && !formEntries.some((e) => e.label.toLowerCase().includes("timeline"))) {
    formEntries.unshift({ label: "Timeline", value: lead.timeline });
  }

  async function moveStage(status: LeadStatus) {
    setMoving(status);
    try {
      const res = await apiPatch<{ lead?: LeadRow }>(`/api/leads/${lead.id}`, { status });
      if (res.ok && res.data.lead) onLeadUpdated(res.data.lead);
    } finally {
      setMoving(null);
    }
  }

  async function copyMagicLink() {
    if (!lead.magic_token) return;
    const url = `${API_BASE}/l/${lead.magic_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function handleLogged(updated?: LeadRow) {
    if (updated) onLeadUpdated(updated);
    void loadLogs();
  }

  return (
    <div className="space-y-5 pb-6">
      {briefingLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : briefing || suggestion ? (
        <div className="rounded-2xl border border-accent-border bg-accent-muted p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-accent-border bg-accent-muted">
              <Sparkles size={14} className="text-accent" />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">AI briefing</p>
          </div>
          {briefing ? (
            <p className="text-[15px] leading-relaxed text-ink-primary">{briefing}</p>
          ) : null}
          {suggestion ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent-border bg-bg-primary/40 px-3 py-2.5">
              <ArrowRight size={14} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[14px] leading-relaxed text-ink-primary">{suggestion}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {lead.is_stale ? (
        <div className="rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-4 py-3.5 text-[14px] leading-relaxed text-ink-primary">
          Stale lead — follow up to recover this opportunity.
        </div>
      ) : null}

      {typeof lead.score === "number" ? (
        <div className="rounded-2xl border border-border bg-surface-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">Lead score</p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                heat === "hot"
                  ? "bg-[var(--warning)]/20 text-[var(--warning)]"
                  : heat === "warm"
                    ? "bg-accent-muted text-accent"
                    : "bg-bg-quaternary text-ink-tertiary"
              }`}
            >
              {lead.score}%
            </span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-bg-quaternary">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.min(100, lead.score)}%` }}
            />
          </div>
          {lead.score_breakdown ? (
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(lead.score_breakdown).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-bg-tertiary px-2 py-2 text-center">
                  <p className="text-[14px] font-bold text-ink-primary">{value}</p>
                  <p className="text-[10px] capitalize text-ink-tertiary">{key.replace(/_/g, " ")}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <StatusCard lead={lead} />

      <div className="space-y-3">
        <ContactCard type="phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
        {lead.email ? (
          <ContactCard type="email" value={lead.email} href={`mailto:${lead.email}`} />
        ) : (
          <ContactCard type="email" value={null} />
        )}
      </div>

      <MetaCard>
        <MetaRow
          label="Source & created"
          value={
            <span className="text-ink-secondary">
              {lead.source ?? "Unknown"} ·{" "}
              {new Date(lead.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          }
        />
        {lead.clients?.name ? (
          <MetaRow label="Company" value={lead.clients.name} icon={<Building2 size={14} />} />
        ) : null}
        {lead.deal_value ? (
          <MetaRow label="Deal value" value={String(lead.deal_value)} />
        ) : null}
      </MetaCard>

      {lead.magic_token ? (
        <div className="rounded-2xl border border-border bg-surface-card p-4">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
            <Link2 size={14} /> Magic link
          </div>
          <p className="mb-3 break-all font-mono text-[11px] text-ink-secondary">
            {API_BASE}/l/{lead.magic_token}
          </p>
          <CrmButton variant="secondary" className="w-full" onClick={() => void copyMagicLink()}>
            {copiedLink ? <Check size={16} /> : <Copy size={16} />}
            {copiedLink ? "Copied" : "Copy link"}
          </CrmButton>
        </div>
      ) : null}

      {!isClosed && MOVE_COLS.includes(lead.status as LeadStatus) ? (
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">Move to</p>
          <div className="grid grid-cols-2 gap-2">
            {MOVE_COLS.filter((c) => c !== lead.status).map((col) => (
              <button
                key={col}
                type="button"
                disabled={moving !== null}
                onClick={() => void moveStage(col)}
                className="min-h-[48px] rounded-xl border border-border bg-surface-card px-3 text-left text-[14px] font-medium text-ink-primary active:bg-bg-tertiary disabled:opacity-50"
              >
                {moving === col ? "…" : `→ ${COL_LABEL[col]}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {formEntries.length > 0 ? (
        <section>
          <SectionHeader
            icon={<ClipboardList size={16} />}
            title="Form answers"
            subtitle="What the lead submitted"
          />
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            {formEntries.map((entry, i) => (
              <div
                key={`${entry.label}-${i}`}
                className={`px-4 py-4 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <dt className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
                  {entry.label}
                </dt>
                <dd className="break-words text-[15px] leading-relaxed text-ink-primary">{entry.value}</dd>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader icon={<Phone size={16} />} title="Call history" subtitle="Your logged touchpoints" />
        {onLogCall ? (
          <button
            type="button"
            onClick={onLogCall}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-bg-tertiary px-4 py-3 text-[14px] font-medium text-accent touch-manipulation"
          >
            <ClipboardList size={16} />
            Log a call
          </button>
        ) : null}
        {logsError ? <p className="text-[13px] text-ink-tertiary">{logsError}</p> : null}
        {logs === null && !logsError ? (
          <p className="text-[13px] text-ink-tertiary">Loading…</p>
        ) : null}
        {logs && logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-bg-tertiary px-4 py-8 text-center">
            <p className="text-[14px] text-ink-secondary">No calls logged yet</p>
            <p className="mt-1 text-[12px] text-ink-tertiary">Log your first touchpoint below</p>
          </div>
        ) : null}
        {logs && logs.length > 0 ? (
          <div className="rounded-2xl border border-border bg-surface-card px-4 py-2">
            <ul className="relative list-none space-y-0 p-0">
              <div className="absolute bottom-3 left-[7px] top-5 border-l border-border" aria-hidden />
              {logs.map((log) => (
                <li key={log.id} className="relative border-b border-border py-4 pl-6 last:border-b-0">
                  <span
                    className={`absolute left-[7px] top-[26px] h-2 w-2 -translate-x-1/2 rounded-full ${
                      log.outcome === "LOST" || log.result === "lost"
                        ? "bg-[var(--error)]"
                        : log.reach_outcome === "no_answer"
                          ? "bg-[var(--warning)]"
                          : "bg-accent"
                    }`}
                    aria-hidden
                  />
                  <div className="flex items-start justify-between gap-3">
                    <CallHistoryOutcome log={log} />
                    <div className="shrink-0 text-right">
                      <span className="font-mono text-[11px] tabular-nums text-ink-tertiary">
                        {new Date(log.created_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-tertiary">{timeAgo(log.created_at)}</p>
                    </div>
                  </div>
                  <p className="mt-1.5 pl-0 font-mono text-[10px] text-ink-tertiary">
                    {log.users?.name ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-surface-card p-4">
        <LogCallForm
          lead={lead}
          online={online}
          variant="inline"
          onLogged={handleLogged}
          onOpenSendTab={onOpenSendTab}
        />
      </section>
    </div>
  );
}
