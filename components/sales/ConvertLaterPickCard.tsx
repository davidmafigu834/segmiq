"use client";

import { useState } from "react";
import { Phone, PhoneOff, MessageCircle, Star, ExternalLink } from "lucide-react";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import {
  formatPickCallback,
  type PickCallLogContext,
} from "@/lib/convert-later-picks";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";
import { openLeadPanel } from "@/store/uiStore";

type Props = {
  lead: LeadWithClientResponseLimit;
  logContext?: PickCallLogContext;
  onLeadUpdated: (lead: LeadWithClientResponseLimit) => void;
};

export function ConvertLaterPickCard({
  lead,
  logContext,
  onLeadUpdated,
}: Props) {
  const [unpicking, setUnpicking] = useState(false);
  const phone = lead.phone?.trim() ?? "";
  const callbackLabel = formatPickCallback(logContext, lead.follow_up_date);

  async function handleUnpick() {
    if (unpicking) return;
    setUnpicking(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_convert_later_pick: false }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        lead?: LeadWithClientResponseLimit;
        error?: string;
      };
      if (res.ok && json.lead) {
        onLeadUpdated({ ...json.lead, clients: lead.clients });
      }
    } finally {
      setUnpicking(false);
    }
  }

  const actionButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-card)] text-[var(--success-fg)] transition-colors hover:border-[var(--border-hover)]";
  const textButtonClass =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-[12px] text-ink-secondary transition-colors hover:border-[var(--border-hover)] hover:text-ink-primary";

  return (
    <article className="ag-fade-in rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openLeadPanel(lead.id)}
            className="text-left text-[15px] font-medium text-[var(--text-primary)] hover:underline"
          >
            {lead.name ?? "Unknown"}
          </button>
          {lead.convert_later_note?.trim() ? (
            <p className="mt-1.5 text-[13px] leading-snug text-ink-secondary">
              {lead.convert_later_note.trim()}
            </p>
          ) : null}
        </div>
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2 font-mono text-[10px] uppercase tracking-wide text-[var(--status-won-fg)]">
          <Star className="h-3 w-3 text-[var(--accent-fg)]" fill="currentColor" strokeWidth={1.5} />
          Pick
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3">
        {logContext?.reason?.trim() ? (
          <div className="flex flex-wrap gap-x-2 text-[12px]">
            <dt className="font-mono uppercase tracking-wide text-ink-tertiary">Hold-up</dt>
            <dd className="text-ink-primary">{logContext.reason.trim()}</dd>
          </div>
        ) : null}
        {callbackLabel ? (
          <div className="flex flex-wrap gap-x-2 text-[12px]">
            <dt className="font-mono uppercase tracking-wide text-ink-tertiary">Callback</dt>
            <dd className="text-ink-primary">{callbackLabel}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {phone ? (
          <a href={`tel:${phone}`} className={actionButtonClass} aria-label="Call">
            <Phone size={15} />
          </a>
        ) : (
          <span className={`${actionButtonClass} opacity-30`}>
            <PhoneOff size={15} className="text-ink-tertiary" />
          </span>
        )}

        {phone ? (
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem(`log:channel:${lead.id}`, "whatsapp");
              } catch {}
              void openWhatsAppAndLog({
                leadId: lead.id,
                clientId: lead.client_id,
                leadName: lead.name,
                leadPhone: lead.phone,
                repName: "",
                formData: (lead.form_data as Record<string, unknown> | null) ?? null,
                tier: "neutral",
              });
            }}
            className={actionButtonClass}
            aria-label="Message on WhatsApp"
          >
            <MessageCircle size={15} />
          </button>
        ) : null}

        <button type="button" onClick={() => openLeadPanel(lead.id)} className={textButtonClass}>
          <ExternalLink size={13} />
          Open lead
        </button>

        <button
          type="button"
          disabled={unpicking}
          onClick={() => void handleUnpick()}
          className={`${textButtonClass} text-ink-tertiary hover:text-ink-secondary disabled:opacity-50`}
        >
          <Star size={13} />
          {unpicking ? "Removing…" : "Remove pick"}
        </button>
      </div>
    </article>
  );
}
