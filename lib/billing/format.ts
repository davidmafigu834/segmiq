/** Shared billing display formatters (no currency symbol assumptions — USD now). */

export function formatMoney(amount: number | string | null | undefined, currency = "USD"): string {
  const n = Number(amount ?? 0);
  return `${currency} ${n.toFixed(2)}`;
}

/** Canonical currency display for Company Billing (`$149.00`). */
export function formatBillingMoney(amount: number | string | null | undefined, currency = "USD"): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function maskSecretTail(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 4) return compact;
  return `•••• ${compact.slice(-4)}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const;

export function methodLabel(method: string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}
