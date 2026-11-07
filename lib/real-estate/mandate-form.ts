export type MandateFormPhase = "with_seller" | "complete";
export type MandateFormFilter = "all" | "with_seller" | "complete" | "expiring";

const COMPLETE = new Set(["submitted", "accepted", "review_incomplete", "review_applying"]);

export function mandateFormPhase(status: string): MandateFormPhase {
  return COMPLETE.has(status) ? "complete" : "with_seller";
}

export function mandateFormExpiring(expiryDate: string | null, now = new Date()): boolean {
  if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) return false;
  const end = Date.parse(`${expiryDate}T00:00:00Z`);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = (end - start) / 86_400_000;
  return days >= 0 && days <= 30;
}

export function mandateFormVisible(
  row: { phase: MandateFormPhase; expiryDate: string | null },
  filter: MandateFormFilter,
  now = new Date(),
): boolean {
  if (filter === "all") return true;
  if (filter === "with_seller") return row.phase === "with_seller";
  if (filter === "complete") return row.phase === "complete";
  return row.phase === "complete" && mandateFormExpiring(row.expiryDate, now);
}

export function mandateKindLabel(kind: string | null): string {
  if (kind === "sole") return "Sole";
  if (kind === "open") return "Open";
  return "Mandate";
}

export function mandateFormLabels(answers: Record<string, string>): { sellerName: string; property: string } {
  const sellerName = answers.registeredOwner?.trim()
    || [answers.givenName, answers.surname].filter(Boolean).join(" ").trim()
    || answers.companyName?.trim()
    || "Seller";
  return {
    sellerName,
    property: answers.propertyAddress?.trim() || "Address not in yet",
  };
}

export function mandateFormPlace(address: string | null): { suburb: string | null; city: string | null } {
  const parts = (address ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return {
    suburb: parts[1]?.slice(0, 120) || null,
    city: parts[2]?.slice(0, 120) || null,
  };
}
