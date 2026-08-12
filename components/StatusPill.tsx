import type { LeadStatus } from "@/types";

const classes: Record<
  LeadStatus,
  string
> = {
  NEW: "bg-[var(--status-new-bg)] text-[var(--status-new-fg)]",
  CONTACTED: "bg-[var(--status-contacted-bg)] text-[var(--status-contacted-fg)]",
  QUALIFIED: "bg-[var(--status-contacted-bg)] text-[var(--status-contacted-fg)]",
  CONVERTED_TO_DEAL: "bg-[var(--status-proposal-bg)] text-[var(--status-proposal-fg)]",
  NEGOTIATING: "bg-[var(--status-negotiating-bg)] text-[var(--status-negotiating-fg)]",
  PROPOSAL_SENT: "bg-[var(--status-proposal-bg)] text-[var(--status-proposal-fg)]",
  WON: "bg-surface-sidebar text-accent",
  LOST: "bg-surface-card-alt text-[var(--status-lost-fg)]",
  NOT_QUALIFIED: "bg-surface-card-alt text-[var(--status-lost-fg)]",
};

const DISPLAY: Partial<Record<LeadStatus, string>> = {
  PROPOSAL_SENT: "Proposal Sent",
  CONVERTED_TO_DEAL: "Deal Created",
  NOT_QUALIFIED: "Not Qualified",
};

function labelFor(status: LeadStatus): string {
  if (DISPLAY[status]) return DISPLAY[status]!;
  const raw = String(status).replaceAll("_", " ").toLowerCase();
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeStatus(status: LeadStatus | string | null | undefined): LeadStatus {
  if (status && typeof status === "string" && status in classes) {
    return status as LeadStatus;
  }
  return "NEW";
}

export function StatusPill({ status }: { status: LeadStatus | string | null | undefined }) {
  const s = normalizeStatus(status);
  return (
    <span
      className={`inline-flex h-[22px] min-w-0 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-sm px-2.5 text-[11px] font-medium leading-none ${classes[s]}`}
    >
      {labelFor(s)}
    </span>
  );
}
