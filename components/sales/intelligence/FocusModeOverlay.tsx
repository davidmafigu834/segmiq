"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/sales/ui";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import type {
  DailySalesPlanPayload,
  SalesActionRecommendation,
} from "@/lib/sales/intelligence/types";

const SKIP_REASONS = [
  "Customer asked me to call later",
  "Waiting for information",
  "Wrong contact",
  "Not relevant now",
  "Other",
] as const;

function entityHref(rec: SalesActionRecommendation): string {
  const dealId =
    (typeof rec.metadata?.dealId === "string" && rec.metadata.dealId) ||
    (rec.sourceEntityType === "deal" ? rec.sourceEntityId : null);
  if (dealId) return `/sales/deals/${dealId}`;
  const id = rec.customer?.leadId ?? rec.sourceEntityId;
  if (!id) return "/sales/call-now";
  const source = String(rec.customer?.source ?? "");
  if (source.includes("WHATSAPP")) return `/sales/inbox?lead=${id}`;
  return `/sales/call-now?lead=${id}`;
}

export function FocusModeOverlay({
  plan,
  onClose,
  onMutate,
  onAddProspect,
}: {
  plan: DailySalesPlanPayload;
  onClose: () => void;
  onMutate: (
    rec: SalesActionRecommendation,
    action: "complete" | "snooze" | "skip" | "resolve",
    extra?: { skipReason?: string; snoozePreset?: "later_today" | "tomorrow_morning" }
  ) => Promise<void>;
  onAddProspect?: () => void;
}) {
  const actions = useMemo(
    () => plan.queue.filter((q) => q.actionType !== "PROSPECT_NEW_CUSTOMERS"),
    [plan.queue]
  );
  const [index, setIndex] = useState(0);
  const [skipOpen, setSkipOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const total = Math.max(actions.length, 1);
  const current =
    actions[index] ??
    plan.queue.find((q) => q.actionType === "PROSPECT_NEW_CUSTOMERS") ??
    null;
  const progressLabel = `${Math.min(index + 1, total)} of ${total} priority actions`;

  async function advanceAfter(
    fn: () => Promise<void>
  ) {
    setBusy(true);
    try {
      await fn();
      if (index + 1 >= actions.length) {
        onClose();
      } else {
        setIndex((i) => i + 1);
      }
    } finally {
      setBusy(false);
      setSkipOpen(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-sales-bg/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Focus mode"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-sales-border px-4 sm:px-6">
        <div>
          <p className="text-[13px] font-semibold text-sales-text-primary">Focus</p>
          <p className="text-[12px] text-sales-text-secondary">{progressLabel}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close focus mode">
          <X size={18} strokeWidth={1.8} />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-6 sm:px-6">
        <div className="w-full max-w-lg rounded-sales-xl border border-sales-border bg-sales-surface p-5 shadow-sales-card sm:p-6">
          {!current ? (
            <div className="text-center">
              <p className="text-[16px] font-semibold text-sales-text-primary">
                Priority actions complete
              </p>
              <p className="mt-2 text-[13px] text-sales-text-secondary">
                {plan.focus.mode === "BUILD"
                  ? "Keep building pipeline with new prospects."
                  : "Nice work — check back when new priorities appear."}
              </p>
              {plan.focus.mode === "BUILD" ? (
                <Button
                  variant="primary"
                  className="mt-4 min-h-11"
                  onClick={() => onAddProspect?.()}
                >
                  Add prospect
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                Your next action
              </p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-sales-text-primary">
                {current.title}
              </h2>
              {current.subtitle ? (
                <p className="mt-1 text-[13px] text-sales-text-secondary">{current.subtitle}</p>
              ) : null}
              {current.urgencyLabel ? (
                <p className="mt-1 text-[12px] font-medium text-sales-text-muted">
                  {current.urgencyLabel}
                </p>
              ) : null}

              <div className="mt-5 rounded-[10px] border border-sales-border-subtle bg-[var(--sales-neutral-50)] px-3.5 py-3 dark:bg-[var(--sales-surface-raised)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-sales-text-muted">
                  Recommended action
                </p>
                <p className="mt-1 text-[15px] font-semibold text-sales-text-primary">
                  {current.recommendedActionLabel}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">
                  <span className="font-medium text-sales-text-primary">Why. </span>
                  {current.reason}
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                {current.availableActions.includes("call") && current.customer?.phone ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="min-h-12 w-full"
                    leftIcon={<Phone size={18} strokeWidth={1.8} />}
                    disabled={busy}
                    onClick={() => {
                      window.location.href = `tel:${current.customer!.phone}`;
                    }}
                  >
                    Call {current.customer.name.split(" ")[0]}
                  </Button>
                ) : null}
                {current.availableActions.includes("whatsapp") && current.customer?.phone ? (
                  <Button
                    variant="secondary"
                    size="lg"
                    className="min-h-12 w-full"
                    leftIcon={<SiWhatsapp size={18} color="#25D366" />}
                    disabled={busy}
                    onClick={() => {
                      const leadId = current.customer?.leadId;
                      const phone = current.customer?.phone;
                      if (!leadId || !phone) return;
                      void openWhatsAppAndLog({
                        leadId,
                        clientId: "",
                        leadName: current.customer?.name ?? null,
                        leadPhone: phone,
                        repName: "",
                      });
                    }}
                  >
                    WhatsApp
                  </Button>
                ) : null}
                {current.availableActions.includes("add_prospect") ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="min-h-12 w-full"
                    disabled={busy}
                    onClick={() => onAddProspect?.()}
                  >
                    Add prospect
                  </Button>
                ) : null}
                {(current.customer?.leadId || current.sourceEntityId) &&
                !current.availableActions.includes("add_prospect") ? (
                  <Link
                    href={entityHref(current)}
                    onClick={onClose}
                    className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-sales-md text-[13px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                  >
                    Open lead
                  </Link>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-sales-border-subtle pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void advanceAfter(() =>
                      onMutate(current, "snooze", { snoozePreset: "later_today" })
                    )
                  }
                >
                  Snooze
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setSkipOpen((v) => !v)}
                >
                  Skip
                </Button>
              </div>

              {skipOpen ? (
                <div className="mt-3 space-y-2 rounded-[10px] border border-sales-border p-3">
                  <p className="text-[12px] font-medium text-sales-text-primary">
                    Why are you skipping?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {SKIP_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        disabled={busy}
                        className="rounded-[8px] px-3 py-2.5 text-left text-[13px] text-sales-text-secondary transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary"
                        onClick={() =>
                          void advanceAfter(() =>
                            onMutate(current, "skip", { skipReason: reason })
                          )
                        }
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
