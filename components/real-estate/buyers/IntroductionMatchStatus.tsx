"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V4 */
/* Component-scope: skipping macrostructure. */

import { ReStatusBadge } from "@/components/real-estate/ui";

export function strengthLabel(strength: string): string {
  if (strength === "strong") return "Strong match";
  if (strength === "alternative") return "Alternative";
  if (strength === "partial") return "Partial match";
  return "Match";
}

export function IntroductionMatchStatus({
  status,
  note,
  contactName,
  phone,
  managedBy,
  canRequest,
  busy,
  error,
  onRequest,
}: {
  status: string | null;
  note: string | null;
  contactName: string | null;
  phone: string | null;
  managedBy: string;
  canRequest: boolean;
  busy: boolean;
  error: string | null;
  onRequest: () => void;
}) {
  if (status === "requested") {
    return (
      <div className="mt-2 space-y-1">
        <ReStatusBadge label="Introduction pending" tone="warning" />
        <p className="text-[13px] text-sales-text-secondary">{note || "Awaiting review by agency management."}</p>
      </div>
    );
  }
  if (status === "accepted") {
    return (
      <div className="mt-2 space-y-1">
        <ReStatusBadge label="Introduction approved" tone="success" />
        {contactName ? <p className="text-[14px] font-semibold text-sales-text-primary [overflow-wrap:anywhere]">{contactName}</p> : null}
        {phone ? <p className="text-[13px] text-sales-text-secondary">{phone}</p> : null}
        <p className="text-[13px] text-sales-text-secondary">
          {managedBy === "Unassigned" ? "No agent is assigned. Agency management approved this request." : `Responsible agent: ${managedBy}.`}
        </p>
        <p className="text-[13px] text-sales-text-muted">Ask the responsible agent or agency management to arrange the next step. This does not open the full buyer search.</p>
      </div>
    );
  }
  if (status === "declined") {
    return (
      <div className="mt-2 space-y-1">
        <ReStatusBadge label="Introduction declined" tone="danger" />
        <p className="text-[13px] text-sales-text-secondary">Buyer details stay private.</p>
      </div>
    );
  }
  if (!canRequest) return null;
  return (
    <div className="mt-2 space-y-1">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        className="re-focus inline-flex min-h-11 items-center rounded-sales-sm px-3 text-[13px] font-semibold text-sales-brand hover:bg-sales-surface-hover focus-visible:outline-none active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onRequest}
      >
        {busy ? "Sending…" : "Request introduction"}
      </button>
      {error ? (
        <p className="text-[13px] text-sales-danger-fg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
