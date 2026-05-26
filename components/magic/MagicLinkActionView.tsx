"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Check, ChevronDown, ChevronUp, Phone } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { ClientAvatar } from "@/components/ClientAvatar";
import { FormAnswersSection } from "@/components/leads/FormAnswersSection";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { formatTimeAgo } from "@/lib/format";
import type { CallOutcome, LeadRow, LeadSource, LeadStatus } from "@/types";

export type MagicCallLogRow = {
  id: string;
  outcome: string;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  users: { name: string } | null;
};

export type MagicLeadClient = { id: string; name: string; slug: string };
export type MagicLeadAssignee = { id: string; name: string };

export type MagicLeadForView = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  budget: string | null;
  project_type: string | null;
  timeline: string | null;
  form_data: Record<string, unknown> | null;
  created_at: string;
  magic_token_expires_at: string | null;
  client_id: string;
  assigned_to_id: string | null;
  clients: MagicLeadClient | null;
  assigned_to: MagicLeadAssignee | null;
  call_logs: MagicCallLogRow[];
};

function firstName(full: string | null): string {
  const t = (full ?? "").trim();
  if (!t) return "this lead";
  return t.split(/\s+/)[0] ?? t;
}

function formatSourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return String(source).replace(/_/g, " ");
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

function outcomePillClass(outcome: string): string {
  if (outcome === "WON") return "bg-surface-sidebar text-accent";
  if (outcome === "LOST" || outcome === "NOT_QUALIFIED") return "bg-surface-card-alt text-[var(--status-lost-fg)]";
  return "bg-surface-card-alt text-ink-secondary";
}

export function MagicLinkActionView({ lead, token }: { lead: MagicLeadForView; token: string }) {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [localLogs, setLocalLogs] = useState<MagicCallLogRow[]>(lead.call_logs ?? []);
  const [historyOpen, setHistoryOpen] = useState(false);

  const client = lead.clients;
  const phone = (lead.phone ?? "").trim();
  const exp = lead.magic_token_expires_at;
  const daysLeft = useMemo(() => {
    if (!exp) return null;
    const ms = new Date(exp).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / 86_400_000));
  }, [exp]);

  function onMagicSubmitSuccess(ctx: { outcome: CallOutcome; lead: LeadRow; followUpDate: string | null; notes: string }) {
    const { outcome, followUpDate, notes } = ctx;
    let msg = "Call note saved.";
    if (outcome === "WON") msg = "Deal closed. Your manager has been notified.";
    if (outcome === "FOLLOW_UP" && followUpDate) {
      msg = `Follow-up scheduled for ${format(new Date(followUpDate + "T12:00:00"), "MMMM d, yyyy")}. You'll get a WhatsApp reminder.`;
    }
    if (outcome === "LOST" || outcome === "NOT_QUALIFIED") msg = "Lead archived.";
    setSuccessMessage(msg);
    setSaveSuccess(true);
    setLocalLogs((prev) => [
      {
        id: `local-${Date.now()}`,
        outcome,
        notes: notes.trim() ? notes.trim() : null,
        follow_up_date: followUpDate,
        created_at: new Date().toISOString(),
        users: lead.assigned_to ? { name: lead.assigned_to.name } : { name: "—" },
      },
      ...prev,
    ]);
  }

  const hasHistory = localLogs.length > 0;

  return (
    <div className="min-h-[100dvh] w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-white pb-[max(7rem,env(safe-area-inset-bottom))] text-ink-primary [-webkit-tap-highlight-color:transparent]">
      <header className="safe-top sticky top-0 z-30 flex min-h-[52px] w-full min-w-0 max-w-[100vw] items-center justify-between gap-2 border-b border-border bg-white/95 px-3 backdrop-blur-sm sm:gap-3 sm:px-4">
        <span className="shrink-0 font-serif text-lg tracking-tight text-ink-primary">Segmiq</span>
        <div className="flex min-w-0 shrink justify-end pl-1 sm:pl-2">
          <StatusPill status={lead.status} />
        </div>
      </header>

      <div className="mx-auto w-full min-w-0 max-w-md px-3 pt-5 text-center sm:px-4 sm:pt-6">
        <h1 className="break-words px-0.5 font-serif text-[clamp(1.25rem,5.5vw,1.75rem)] leading-tight text-ink-primary">
          {lead.name ?? "Lead"}
        </h1>
        {phone ? (
          <p className="mt-2 break-all font-mono text-[15px] text-ink-tertiary">{lead.phone}</p>
        ) : (
          <p className="mt-2 font-mono text-[15px] text-ink-tertiary">No phone on file</p>
        )}
        {client ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 px-1">
            <ClientAvatar name={client.name} size={28} />
            <span className="min-w-0 max-w-full text-pretty text-sm text-ink-secondary">
              <span className="font-medium text-ink-primary">{client.name}</span> lead
            </span>
          </div>
        ) : null}
        <p className="mt-3 break-words px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-tertiary sm:text-[11px] sm:tracking-[0.12em]">
          {formatSourceLabel(lead.source as string)} · {formatTimeAgo(lead.created_at)}
        </p>
      </div>

      {phone ? (
        <div className="sticky top-[calc(52px+env(safe-area-inset-top,0px))] z-20 w-full min-w-0 max-w-[100vw] border-b border-border bg-white px-3 py-3 sm:px-4">
          <a
            href={`tel:${phone}`}
            className="flex w-full min-w-0 touch-manipulation items-center justify-center gap-2 rounded-lg bg-accent px-3 py-3.5 text-base font-medium text-[var(--accent-ink)] transition-transform active:scale-[0.98] sm:gap-3 sm:py-4"
          >
            <Phone className="h-5 w-5 shrink-0" strokeWidth={2.2} />
            <span className="min-w-0 truncate">
              Call {firstName(lead.name)}
            </span>
          </a>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <a href={`sms:${phone}`} className="text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline">
              SMS
            </a>
            <button
              type="button"
              className="text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(phone);
                } catch {
                  /* ignore */
                }
              }}
            >
              Copy number
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-md min-w-0">
        <FormAnswersSection
          formData={lead.form_data}
          lead={{
            budget: lead.budget,
            project_type: lead.project_type,
            timeline: lead.timeline,
          }}
          className="border-b-0 px-3 sm:px-4"
        />

        {hasHistory ? (
          <div className="border-b border-border px-3 py-4 sm:px-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setHistoryOpen((o) => !o)}
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">Previous calls</span>
              {historyOpen ? <ChevronUp className="h-4 w-4 text-ink-tertiary" /> : <ChevronDown className="h-4 w-4 text-ink-tertiary" />}
            </button>
            {historyOpen ? (
              <ul className="mt-3 space-y-3">
                {localLogs.map((log) => (
                  <li key={log.id} className="rounded-md border border-border bg-surface-canvas p-3 text-left">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className={`inline-flex h-[22px] shrink-0 items-center rounded-sm px-2.5 text-[10px] font-medium uppercase ${outcomePillClass(log.outcome)}`}>
                        {log.outcome.replaceAll("_", " ")}
                      </span>
                      <span className="font-mono text-[10px] text-ink-tertiary">{formatTimeAgo(log.created_at)}</span>
                    </div>
                    <div className="mt-2">
                      <CallHistoryOutcome outcome={log.outcome} notes={log.notes} />
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-ink-tertiary">by {log.users?.name ?? "—"}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="min-w-0 px-3 py-5 sm:px-4 sm:py-6">
          {!saveSuccess ? (
            <LogCallForm
              leadId={lead.id}
              magicToken={token}
              variant="magic"
              onMagicSubmitSuccess={onMagicSubmitSuccess}
            />
          ) : (
            <div className="min-w-0 py-8 text-center sm:py-10">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-bg)]">
                <Check className="h-8 w-8 text-[var(--success-fg)]" strokeWidth={2.2} />
              </div>
              <h2 className="mb-2 px-1 font-serif text-xl text-ink-primary sm:text-2xl">Call logged</h2>
              <p className="mx-auto mb-8 max-w-xs px-1 text-pretty text-sm text-ink-secondary">{successMessage}</p>
              <div className="mx-auto flex w-full min-w-0 max-w-xs flex-col gap-2 px-1">
                <Link
                  href="/login"
                  className="rounded-md bg-surface-sidebar py-3 text-center text-sm font-medium text-[var(--text-on-dark)]"
                >
                  Open Segmiq
                </Link>
                <button
                  type="button"
                  className="py-3 text-sm text-ink-secondary hover:text-ink-primary"
                  onClick={() => setSaveSuccess(false)}
                >
                  Log another call
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mx-auto w-full min-w-0 max-w-md px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center text-[11px] text-ink-tertiary sm:px-4">
        <p className="break-words">
          Segmiq · Secure link
          {daysLeft != null ? (daysLeft === 0 ? " has expired" : ` expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`) : " is active"}
        </p>
        <p className="mt-1 break-words">Not expecting this? Forward to your manager.</p>
      </footer>
    </div>
  );
}
