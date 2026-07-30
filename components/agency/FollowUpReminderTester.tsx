"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import type { FollowUpPreviewLead, FollowUpPreviewResult, FollowUpReminderResult } from "@/lib/follow-up-reminders";
import { loadFollowUpPreview, runFollowUpRemindersTest } from "@/app/(agency)/dashboard/follow-up-reminders/actions";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]";

function batchLabel(batch: FollowUpPreviewLead["batch"]): string {
  switch (batch) {
    case "morning":
      return "Morning digest";
    case "t30_rep":
      return "T-30 (rep)";
    case "t30_lead":
      return "T-30 (lead)";
  }
}

function batchBadgeStyle(batch: FollowUpPreviewLead["batch"]): string {
  switch (batch) {
    case "morning":
      return "bg-amber-500/15 text-amber-400";
    case "t30_rep":
      return "bg-blue-500/15 text-blue-400";
    case "t30_lead":
      return "bg-emerald-500/15 text-emerald-400";
  }
}

function summarizeResult(result: FollowUpReminderResult): string {
  const parts = [
    `Morning: ${result.morning.whatsappSent} sent, ${result.morning.skipped} skipped, ${result.morning.whatsappFailed} failed`,
    `T-30 rep: ${result.t30Rep.whatsappSent} sent, ${result.t30Rep.skipped} skipped, ${result.t30Rep.whatsappFailed} failed`,
    `T-30 lead: ${result.t30Lead.whatsappSent} sent, ${result.t30Lead.skipped} skipped, ${result.t30Lead.whatsappFailed} failed`,
  ];
  return parts.join(" · ");
}

export function FollowUpReminderTester() {
  const [preview, setPreview] = useState<FollowUpPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<FollowUpReminderResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [leadIdFilter, setLeadIdFilter] = useState("");

  const refreshPreview = useCallback(async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    const r = await loadFollowUpPreview();
    setLoadingPreview(false);
    if (r.ok) {
      setPreview(r.preview);
    } else {
      setPreviewError(r.error);
    }
  }, []);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    const r = await runFollowUpRemindersTest({
      dryRun,
      force,
      leadId: leadIdFilter.trim() || undefined,
    });
    setRunning(false);
    if (r.ok) {
      setRunResult(r.result);
      void refreshPreview();
    } else {
      setRunError(r.error);
    }
  }

  const actionable = preview?.leads.filter((l) => !l.wouldSkipReason) ?? [];
  const blocked = preview?.leads.filter((l) => l.wouldSkipReason) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Bell className="h-5 w-5 text-[var(--accent)]" />
              Run follow-up reminders
            </div>
            <p className="mt-1 max-w-[640px] text-[13px] text-[var(--text-secondary)]">
              Triggers the same job as the production cron. Use dry run first to preview, then send live
              with optional force to bypass today&apos;s dedup.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshPreview()}
            disabled={loadingPreview}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
          >
            {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh preview
          </button>
        </div>

        {preview && (
          <div className="mt-4 flex flex-wrap gap-3 text-[12px] font-mono uppercase tracking-wide text-[var(--text-tertiary)]">
            <span>Timezone: {preview.timezone}</span>
            <span>Today: {preview.today}</span>
            <span>Tomorrow: {preview.tomorrow}</span>
            <span>Morning digests: {preview.counts.morning}</span>
            <span>T-30 rep: {preview.counts.t30Rep}</span>
            <span>T-30 lead: {preview.counts.t30Lead}</span>
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-secondary)]">
              Limit to lead ID (optional)
            </label>
            <input
              className={inputCls}
              placeholder="UUID of a single lead"
              value={leadIdFilter}
              onChange={(e) => setLeadIdFilter(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry run (no sends)
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Force (ignore dedup)
          </label>
        </div>

        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={running}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {dryRun ? "Run dry test" : "Send reminders now"}
        </button>

        {runError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {runError}
          </div>
        )}

        {runResult && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-[13px] text-emerald-400">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">
                {runResult.dryRun ? "Dry run complete" : "Reminders processed"}
              </div>
              <div className="mt-1 text-[var(--text-secondary)]">{summarizeResult(runResult)}</div>
            </div>
          </div>
        )}
      </div>

      {previewError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-400">
          {previewError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <LeadPreviewPanel
          title="Would send"
          emptyLabel="No leads match right now"
          leads={actionable}
          icon={CheckCircle}
          iconColor="var(--success)"
        />
        <LeadPreviewPanel
          title="Would skip"
          emptyLabel="Nothing blocked"
          leads={blocked}
          icon={Clock}
          iconColor="var(--warning)"
          showSkipReason
        />
      </div>
    </div>
  );
}

function LeadPreviewPanel({
  title,
  emptyLabel,
  leads,
  icon: Icon,
  iconColor,
  showSkipReason = false,
}: {
  title: string;
  emptyLabel: string;
  leads: FollowUpPreviewLead[];
  icon: typeof CheckCircle;
  iconColor: string;
  showSkipReason?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
      <div className="mb-4 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
        {title}
        <span className="ml-auto rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] font-mono">
          {leads.length}
        </span>
      </div>

      {leads.length === 0 ? (
        <p className="text-[13px] text-[var(--text-tertiary)]">{emptyLabel}</p>
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto">
          {leads.map((l) => (
            <li
              key={`${l.batch}-${l.leadId}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-[13px]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--text-primary)]">{l.leadName ?? "Unnamed lead"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${batchBadgeStyle(l.batch)}`}>
                  {batchLabel(l.batch)}
                </span>
              </div>
              <div className="mt-1 text-[var(--text-secondary)]">
                Rep: {l.assigneeName ?? "—"}
                {l.assigneePhone ? ` · ${l.assigneePhone}` : " · no phone"}
              </div>
              {l.followUpDate && (
                <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">Follow-up date: {l.followUpDate}</div>
              )}
              {l.callbackAt && (
                <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                  Callback: {new Date(l.callbackAt).toLocaleString()}
                </div>
              )}
              {showSkipReason && l.wouldSkipReason && (
                <div className="mt-1 text-[12px] text-amber-400">{l.wouldSkipReason}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
