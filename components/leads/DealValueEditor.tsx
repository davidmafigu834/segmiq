"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { formatCurrencyUsd } from "@/lib/format";
import {
  canEnterManualDealValue,
  canSetManualDealValue,
  dealValueSourceLabel,
  parseDealValueInput,
  type DealValueSource,
} from "@/lib/deal-value";
import type { LeadRow } from "@/types";

export function DealValueEditor({
  lead,
  disabled,
  onUpdated,
}: {
  lead: LeadRow;
  disabled?: boolean;
  onUpdated?: (lead: LeadRow) => void;
}) {
  const locked = !canSetManualDealValue(lead.deal_value_source as DealValueSource | null);
  const canEdit = !disabled && !locked && canEnterManualDealValue(lead.status);
  const sourceLabel = dealValueSourceLabel(lead.deal_value_source as DealValueSource | null);

  const [value, setValue] = useState(
    lead.deal_value != null ? String(lead.deal_value) : ""
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setValue(lead.deal_value != null ? String(lead.deal_value) : "");
    setMsg(null);
  }, [lead.id, lead.deal_value, lead.deal_value_source]);

  if (!canEdit && lead.deal_value == null && !locked) return null;
  if (!canEdit && lead.deal_value == null && locked) return null;

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const parsed = parseDealValueInput(value);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_value: parsed }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; lead?: LeadRow };
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error ?? "Could not save");
      return;
    }
    if (json.lead) onUpdated?.(json.lead);
  }

  if (locked || (!canEdit && lead.deal_value != null)) {
    return (
      <div className="rounded-xl border border-border bg-surface-card-alt px-4 py-3.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
            Deal value
          </p>
          {sourceLabel ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-tertiary">
              <Lock size={10} aria-hidden />
              {sourceLabel}
            </span>
          ) : null}
        </div>
        <p className="font-display text-[22px] font-semibold tabular-nums text-ink-primary">
          {formatCurrencyUsd(lead.deal_value ?? 0)}
        </p>
        {locked ? (
          <p className="mt-1.5 text-[12px] text-ink-tertiary">
            Set from a sent quotation — cannot be overridden with a manual estimate.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-card-alt px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label
          htmlFor={`deal-value-${lead.id}`}
          className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary"
        >
          Deal estimate
        </label>
        {sourceLabel ? (
          <span className="text-[10px] font-medium text-ink-tertiary">{sourceLabel}</span>
        ) : null}
      </div>
      <p className="mb-2.5 text-[12px] text-ink-tertiary leading-snug">
        Your best guess on job size — powers the revenue forecast until a formal quote is sent.
      </p>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-tertiary">
            $
          </span>
          <input
            id={`deal-value-${lead.id}`}
            type="text"
            inputMode="decimal"
            className="input-base h-10 w-full pl-7 font-mono tabular-nums"
            placeholder="e.g. 3200"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
          />
        </div>
        <button
          type="button"
          className="btn-secondary h-10 shrink-0 px-4 text-[13px]"
          disabled={busy}
          onClick={() => void handleSave()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {msg ? <p className="mt-2 text-[12px] text-[var(--status-lost-fg)]">{msg}</p> : null}
    </div>
  );
}
