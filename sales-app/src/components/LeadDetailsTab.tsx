import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { apiGet, apiPatch, API_BASE } from "../lib/api";
import { formatCallLogHeadline } from "../lib/call-log-display";
import { formatFormData } from "../lib/format-form-data";
import {
  formatFollowUpDate,
  scoreHeat,
  statusLabel,
  timeAgo,
} from "../lib/format";
import type { LeadRow, LeadStatus } from "../lib/types";
import { CrmButton } from "./crm";

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
  onLeadUpdated: (lead: LeadRow) => void;
};

function DetailCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <p className="eyebrow mb-1">{label}</p>
      <div className="text-[16px] text-ink-primary">{children}</div>
    </div>
  );
}

export function LeadDetailsTab({ lead, onLeadUpdated }: Props) {
  const [briefing, setBriefing] = useState<string | null>(null);
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
      const res = await apiGet<{ briefing?: string }>(`/api/leads/${lead.id}/briefing`);
      setBriefing(res.ok ? (res.data.briefing ?? null) : null);
    } catch {
      setBriefing(null);
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
    void loadLogs();
  }, [loadBriefing, loadLogs]);

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

  return (
    <div className="space-y-4 pb-4">
      {briefingLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : briefing ? (
        <div className="rounded-xl border border-accent-border bg-accent-muted p-4">
          <p className="eyebrow mb-2">Briefing</p>
          <p className="text-[15px] leading-relaxed text-ink-primary">{briefing}</p>
        </div>
      ) : null}

      {lead.is_stale ? (
        <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-4 py-3 text-[14px] text-ink-primary">
          Stale lead — follow up to recover this opportunity.
        </div>
      ) : null}

      {typeof lead.score === "number" ? (
        <div className="rounded-xl border border-border bg-surface-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow mb-0">Lead score</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
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

      <DetailCard label="Status">{statusLabel(lead.status)}</DetailCard>

      {lead.phone ? (
        <DetailCard label="Phone">
          <a href={`tel:${lead.phone}`} className="font-mono text-[var(--success)] underline">
            {lead.phone}
          </a>
        </DetailCard>
      ) : (
        <DetailCard label="Phone">
          <span className="text-ink-tertiary">No phone on file</span>
        </DetailCard>
      )}

      {lead.email ? <DetailCard label="Email">{lead.email}</DetailCard> : null}

      <DetailCard label="Source & created">
        <span className="text-[14px] text-ink-secondary">
          {lead.source ?? "Unknown"} · {new Date(lead.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </DetailCard>

      {lead.clients?.name ? <DetailCard label="Company">{lead.clients.name}</DetailCard> : null}

      {lead.follow_up_date ? (
        <DetailCard label="Follow-up">{formatFollowUpDate(lead.follow_up_date)}</DetailCard>
      ) : null}

      {lead.manual_priority ? (
        <DetailCard label="Priority">
          <span className="capitalize">{lead.manual_priority}</span>
        </DetailCard>
      ) : null}

      {lead.deal_value ? (
        <DetailCard label="Deal value">{String(lead.deal_value)}</DetailCard>
      ) : null}

      {lead.magic_token ? (
        <div className="rounded-xl border border-border bg-surface-card p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
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
          <p className="eyebrow mb-2">Move to</p>
          <div className="grid grid-cols-2 gap-2">
            {MOVE_COLS.filter((c) => c !== lead.status).map((col) => (
              <button
                key={col}
                type="button"
                disabled={moving !== null}
                onClick={() => void moveStage(col)}
                className="min-h-[48px] rounded-lg border border-border bg-surface-card px-3 text-left text-[14px] font-medium text-ink-primary active:bg-bg-tertiary disabled:opacity-50"
              >
                {moving === col ? "…" : `→ ${COL_LABEL[col]}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {formEntries.length > 0 ? (
        <div>
          <p className="eyebrow mb-3">Form answers</p>
          <dl className="space-y-3">
            {formEntries.map((entry, i) => (
              <div key={`${entry.label}-${i}`} className="rounded-xl border border-border bg-surface-card p-4">
                <dt className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                  {entry.label}
                </dt>
                <dd className="break-words text-[15px] leading-relaxed text-ink-primary">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div>
        <p className="eyebrow mb-3">Call history</p>
        {logsError ? <p className="text-[13px] text-ink-tertiary">{logsError}</p> : null}
        {logs === null && !logsError ? (
          <p className="text-[13px] text-ink-tertiary">Loading…</p>
        ) : null}
        {logs && logs.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">No calls logged yet.</p>
        ) : null}
        {logs && logs.length > 0 ? (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl border border-border bg-surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-ink-primary">
                    {formatCallLogHeadline(log)}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] text-ink-tertiary">
                    {new Date(log.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-ink-tertiary">
                  {log.users?.name ?? "—"} · {timeAgo(log.created_at)}
                </p>
                {log.notes ? <p className="mt-2 text-[14px] text-ink-secondary">{log.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
