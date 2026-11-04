/** Human labels for compliance states. Internal keys stay on the server. */

export function words(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function requirementStateLabel(state: string): string {
  const labels: Record<string, string> = {
    not_started: "Not started",
    awaiting_information: "Awaiting information",
    submitted: "Awaiting review",
    under_review: "In review",
    more_information_required: "Changes requested",
    verified: "Verified",
    rejected: "Rejected",
    waived: "Waived",
    not_applicable: "Not applicable",
    escalated: "Additional review",
  };
  return labels[state] ?? words(state);
}

export function requirementTone(state: string): "success" | "warning" | "danger" | "neutral" | "info" {
  if (state === "verified" || state === "waived") return "success";
  if (state === "more_information_required" || state === "escalated") return "warning";
  if (state === "rejected") return "danger";
  if (state === "not_applicable" || state === "not_started") return "neutral";
  return "info";
}

export function scanStatusLabel(status: string | null | undefined): string {
  if (status === "clean") return "Safe to open";
  if (status === "infected" || status === "quarantined") return "Blocked";
  if (status === "scan_failed") return "Scan failed";
  if (status === "scanning" || status === "unscanned") return "Awaiting scan";
  return "Awaiting scan";
}

export function invitationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    created: "Created",
    sent: "Sent",
    opened: "Opened",
    in_progress: "In progress",
    submitted: "Submitted",
    changes_requested: "Changes requested",
    expired: "Expired",
    revoked: "Revoked",
  };
  return labels[status] ?? words(status);
}

export function caseTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    buyer: "Buyer",
    seller: "Seller",
    property: "Property",
    transaction: "Transaction",
    Restricted: "Restricted",
  };
  return labels[value] ?? words(value);
}

export function paymentEvidenceLabel(state: string): string {
  const labels: Record<string, string> = {
    reported: "Reported, not yet evidenced",
    proof_uploaded: "Evidence submitted",
    under_verification: "Awaiting verification",
    independently_confirmed: "Independently confirmed",
    disputed: "Disputed",
    rejected: "Rejected",
  };
  return labels[state] ?? words(state);
}

export function waitingLabel(iso?: string | null): string {
  if (!iso) return "";
  const delta = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(delta) || delta < 0) return "";
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
