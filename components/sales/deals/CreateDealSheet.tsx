"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { DealRow, LeadRow } from "@/types";
import { getDealReadiness } from "@/lib/sales/deals/readiness";

type Props = {
  lead: LeadRow;
  open: boolean;
  onClose: () => void;
  onCreated: (deal: DealRow) => void;
};

export function CreateDealSheet({ lead, open, onClose, onCreated }: Props) {
  const [name, setName] = useState(
    () => lead.project_type?.trim() || `${lead.name?.trim() || "Customer"} opportunity`
  );
  const [serviceSummary, setServiceSummary] = useState(lead.project_type ?? "");
  const [customerNeed, setCustomerNeed] = useState(lead.customer_need ?? "");
  const [location, setLocation] = useState("");
  const [buyingTimeframe, setBuyingTimeframe] = useState(
    lead.buying_timeframe ?? lead.timeline ?? ""
  );
  const [salesEstimate, setSalesEstimate] = useState("");
  const [valuePending, setValuePending] = useState(true);
  const [nextActionLabel, setNextActionLabel] = useState("Follow up");
  const [nextActionAt, setNextActionAt] = useState(() => {
    if (lead.follow_up_date) {
      const d = lead.follow_up_date.includes("T")
        ? lead.follow_up_date
        : `${lead.follow_up_date}T09:00:00`;
      return d.slice(0, 16);
    }
    return "";
  });
  const [expectedDecisionAt, setExpectedDecisionAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readiness = useMemo(
    () =>
      getDealReadiness({
        lead,
        discovery: {
          customerNeed: customerNeed || lead.customer_need,
          projectType: serviceSummary || lead.project_type,
          interestConfirmed: true,
          buyingTimeframe,
          nextStepAgreed: Boolean(nextActionAt || nextActionLabel),
          nextActionAt: nextActionAt || null,
          valuePending,
          estimatedValue: salesEstimate ? Number(salesEstimate) : null,
        },
      }),
    [
      lead,
      customerNeed,
      serviceSummary,
      buyingTimeframe,
      nextActionAt,
      nextActionLabel,
      valuePending,
      salesEstimate,
    ]
  );

  if (!open) return null;

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Enter a deal name.");
      return;
    }
    setSaving(true);
    try {
      const estimate = salesEstimate.trim() ? Number(salesEstimate.replace(/[^0-9.]/g, "")) : null;
      const res = await fetch(`/api/leads/${lead.id}/create-deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          serviceSummary: serviceSummary.trim() || null,
          customerNeed: customerNeed.trim() || null,
          location: location.trim() || null,
          buyingTimeframe: buyingTimeframe.trim() || null,
          salesEstimate: estimate && estimate > 0 ? estimate : null,
          estimatedValue: estimate && estimate > 0 ? estimate : null,
          valuePending: valuePending || !(estimate && estimate > 0),
          expectedDecisionAt: expectedDecisionAt || null,
          nextActionAt: nextActionAt
            ? new Date(nextActionAt).toISOString()
            : null,
          nextActionLabel: nextActionLabel.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deal?: DealRow;
      };
      if (!res.ok || !data.deal) {
        setError(data.error || "We couldn't create this Deal. Your Lead information has not been changed.");
        return;
      }
      onCreated(data.deal);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1 min-h-[44px] w-full rounded-[10px] border border-[#E4E7EC] bg-white px-3 text-[14px] text-[#101828] outline-none focus:border-[#D4FF4F] focus:ring-2 focus:ring-[rgba(212,255,79,0.35)] dark:border-[#272C27] dark:bg-[#111411] dark:text-[#F7F8F5]";
  const labelClass = "text-[12px] font-medium text-[#667085] dark:text-[#B1B7AE]";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-deal-title"
        className="relative z-[81] flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[18px] bg-[#F7F8FA] shadow-xl dark:bg-[#0B0D0C] sm:rounded-[18px]"
      >
        <header className="flex items-center justify-between border-b border-[#E4E7EC] bg-white px-4 py-3 dark:border-[#272C27] dark:bg-[#111411]">
          <div>
            <h2 id="create-deal-title" className="text-[16px] font-semibold text-[#101828] dark:text-[#F7F8F5]">
              Create deal
            </h2>
            <p className="text-[12px] text-[#667085] dark:text-[#B1B7AE]">
              {lead.name || "Customer"} · {readiness.statusLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[#667085] hover:bg-[#F2F4F7] dark:hover:bg-[#151815]"
            aria-label="Close create deal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <label className="block">
            <span className={labelClass}>Deal name</span>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Customer need</span>
            <textarea
              className={`${fieldClass} min-h-[72px] py-2`}
              value={customerNeed}
              onChange={(e) => setCustomerNeed(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Service / project</span>
            <input
              className={fieldClass}
              value={serviceSummary}
              onChange={(e) => setServiceSummary(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Location</span>
              <input className={fieldClass} value={location} onChange={(e) => setLocation(e.target.value)} />
            </label>
            <label className="block">
              <span className={labelClass}>Buying timeframe</span>
              <input
                className={fieldClass}
                value={buyingTimeframe}
                onChange={(e) => setBuyingTimeframe(e.target.value)}
                placeholder="Within 30 days"
              />
            </label>
          </div>
          <div className="space-y-2 rounded-[12px] border border-[#E4E7EC] bg-white p-3 dark:border-[#272C27] dark:bg-[#151815]">
            <span className={labelClass}>Estimated value</span>
            <label className="flex items-center gap-2 text-[13px] text-[#344054] dark:text-[#B1B7AE]">
              <input
                type="checkbox"
                checked={valuePending}
                onChange={(e) => setValuePending(e.target.checked)}
              />
              Value pending estimate
            </label>
            {!valuePending ? (
              <input
                className={fieldClass}
                inputMode="decimal"
                placeholder="e.g. 6500"
                value={salesEstimate}
                onChange={(e) => setSalesEstimate(e.target.value)}
              />
            ) : (
              <p className="text-[12px] text-[#98A2B3]">
                Estimate after site assessment if needed — do not invent a number.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Next action</span>
              <input
                className={fieldClass}
                value={nextActionLabel}
                onChange={(e) => setNextActionLabel(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Next action date</span>
              <input
                type="datetime-local"
                className={fieldClass}
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>Expected decision date</span>
            <input
              type="date"
              className={fieldClass}
              value={expectedDecisionAt}
              onChange={(e) => setExpectedDecisionAt(e.target.value)}
            />
          </label>
          {error ? (
            <p className="text-[13px] text-[#B42318]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="border-t border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411]">
          <button
            type="button"
            disabled={saving || !readiness.ready}
            onClick={() => void submit()}
            className="min-h-[48px] w-full rounded-[12px] bg-[#101828] text-[14px] font-semibold text-white disabled:opacity-50 dark:bg-[#D4FF4F] dark:text-[#101828]"
          >
            {saving ? "Creating deal…" : "Create deal"}
          </button>
        </footer>
      </div>
    </div>
  );
}
