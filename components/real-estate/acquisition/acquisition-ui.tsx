"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import {
  ACQUISITION_STAGES,
  STAGE_LABEL,
  assertStageChange,
  isMandateCurrentlyValid,
  type AcquisitionStage,
  type StageEvidence,
} from "@/lib/real-estate/acquisition-plan";
import type { BadgeTone } from "@/components/sales/ui/Badge";

export const acqFieldClass =
  "re-focus min-h-11 w-full rounded-[var(--re-radius-control,8px)] border border-sales-border bg-sales-surface px-3 text-[14px] text-sales-text-primary placeholder:text-sales-text-muted";

export const acqLabelClass = "mb-1 block text-[12px] font-medium text-sales-text-secondary";

/** National number plus a dial code, stored as E.164. A leading 0 is dropped. */
export function composeOwnerPhone(dial: string, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const code = dial.replace(/\D/g, "");
  const national = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (!code || !national) return null;
  return `+${code}${national}`;
}

export function asIsoTimestamp(value: string | FormDataEntryValue | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function intentLabel(intent: string | null | undefined): string {
  if (intent === "sale") return "For sale";
  if (intent === "rent") return "To rent";
  return "Intent not set";
}

export function stageLabel(stage: string | null | undefined): string {
  if (stage && stage in STAGE_LABEL) return STAGE_LABEL[stage as AcquisitionStage];
  return "Stage not set";
}

const PRICE_LABEL: Record<string, string> = {
  owner_asking: "Owner asking price",
  informal_estimate: "Informal estimate",
  professional_valuation: "Professional valuation",
  proposed_listing: "Proposed marketing price",
  agreed_marketing: "Agreed listing price",
};

export function priceTypeLabel(type: string | null | undefined): string {
  if (!type) return "Price";
  return PRICE_LABEL[type] ?? type.replaceAll("_", " ");
}

const INSPECTION_LABEL: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  in_progress: "In progress",
  completed: "Completed",
  incomplete: "Incomplete",
};

export function inspectionStatusLabel(status: string | null | undefined): string {
  if (!status) return "Status not set";
  return INSPECTION_LABEL[status] ?? status.replaceAll("_", " ");
}

export function inspectionTone(status: string): BadgeTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "neutral";
  if (status === "incomplete") return "danger";
  if (status === "in_progress" || status === "confirmed" || status === "scheduled" || status === "rescheduled") return "info";
  return "neutral";
}

const MANDATE_LABEL: Record<string, string> = {
  draft: "Draft",
  awaiting_evidence: "Awaiting evidence",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  revoked: "Revoked",
  superseded: "Superseded",
  legacy_unverified: "Legacy unverified",
};

export function mandateStatusLabel(status: string | null | undefined): string {
  if (!status) return "Status not set";
  return MANDATE_LABEL[status] ?? status.replaceAll("_", " ");
}

export function mandateTone(status: string): BadgeTone {
  if (status === "approved") return "success";
  if (status === "expiring_soon" || status === "legacy_unverified" || status === "awaiting_evidence") return "warning";
  if (status === "submitted") return "info";
  if (status === "expired" || status === "revoked" || status === "rejected") return "danger";
  return "neutral";
}

export function mandateTypeLabel(type: string | null | undefined): string {
  if (type === "sole") return "Sole";
  if (type === "joint") return "Joint";
  if (type === "open") return "Open";
  return "Type not set";
}

/** Same comparison the overview uses. A missing time is not treated as overdue. */
export function isOverdue(iso: string | null | undefined, status?: string | null): boolean {
  if (!iso || status === "lost" || status === "converted") return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return time < Date.now();
}

export function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return date.toLocaleString("en-GB", dateOnly
    ? { day: "numeric", month: "short", year: "numeric" }
    : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function placeLabel(row: { suburb?: string | null; city?: string | null; address?: string | null }): string {
  const place = [row.suburb, row.city].filter(Boolean).join(", ");
  return place || row.address || "Location pending";
}

type EvidenceInput = {
  inspections: Array<Record<string, unknown>>;
  mandates: Array<Record<string, unknown>>;
  listingId: string | null;
};

/** Client-side mirror of the server evidence check. The server still decides. */
export function evidenceFromBundle(input: EvidenceInput): StageEvidence {
  const scheduled = ["scheduled", "confirmed", "rescheduled", "in_progress", "completed"];
  return {
    hasScheduledInspection: input.inspections.some((row) => scheduled.includes(String(row.status))),
    hasCompletedInspection: input.inspections.some((row) => row.status === "completed"),
    hasValidMandate: input.mandates.some((row) =>
      isMandateCurrentlyValid({
        status: String(row.status),
        expiryDate: (row.expiry_date as string | null) ?? null,
        revocationEffectiveDate: (row.revocation_effective_date as string | null) ?? null,
      })
    ),
    hasListing: Boolean(input.listingId),
    listingApproval: null,
  };
}

export function stageChoices(evidence: StageEvidence) {
  return ACQUISITION_STAGES.map((stage) => {
    const decision = assertStageChange(stage, evidence);
    const unknownApproval = stage === "submitted_for_approval" && evidence.hasListing && !decision.ok;
    return {
      stage,
      label: STAGE_LABEL[stage],
      blocked: !decision.ok && !unknownApproval,
      reason: decision.ok ? null : decision.error,
    };
  });
}
