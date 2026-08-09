import { differenceInCalendarDays, format, isToday, isTomorrow } from "date-fns";

/** Safe percentage change for dashboard trends. */
export function formatTrend(
  current: number,
  previous: number
): { label: string; direction: "up" | "down" | "flat" | "new" | "none" } {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { label: "—", direction: "none" };
  }
  if (previous === 0 && current === 0) {
    return { label: "—", direction: "none" };
  }
  if (previous === 0 && current > 0) {
    return { label: "New", direction: "new" };
  }
  // Tiny prior baselines produce absurd % (e.g. 1 → 140). Treat as "New".
  if (previous > 0 && previous <= 2 && current >= previous * 10) {
    return { label: "New", direction: "new" };
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct === 0) return { label: "No change", direction: "flat" };
  // Cap extreme swings for display readability
  if (Math.abs(pct) > 500) {
    return {
      label: pct > 0 ? "Strong increase" : "Strong decrease",
      direction: pct > 0 ? "up" : "down",
    };
  }
  if (pct > 0) return { label: `${pct}%`, direction: "up" };
  return { label: `${Math.abs(pct)}%`, direction: "down" };
}

/** Convert a stored changePct (null | number) into a safe display trend. */
export function formatTrendFromPct(
  changePct: number | null | undefined,
  opts?: { current?: number; previous?: number }
): { label: string; direction: "up" | "down" | "flat" | "new" | "none" } {
  if (opts && opts.current != null && opts.previous != null) {
    return formatTrend(opts.current, opts.previous);
  }
  if (changePct == null || !Number.isFinite(changePct)) {
    return { label: "—", direction: "none" };
  }
  // Guard against invalid 100% when both periods are empty (backend sometimes emits 100).
  if (opts?.current === 0 && opts?.previous === 0) {
    return { label: "—", direction: "none" };
  }
  if (changePct === 0) return { label: "No change", direction: "flat" };
  if (changePct === 100 && (opts?.previous === 0 || opts?.previous == null)) {
    return { label: "New", direction: "new" };
  }
  if (changePct > 0) return { label: `up ${changePct}%`, direction: "up" };
  return { label: `down ${Math.abs(changePct)}%`, direction: "down" };
}

export function formatDealValue(
  value: number | null | undefined,
  opts?: { compact?: boolean }
): string {
  if (value == null || !Number.isFinite(value)) return "Value not set";
  if (value === 0) return "$0";
  if (opts?.compact && value >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Minutes → clean response-time label. */
export function formatResponseTime(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const totalSec = Math.max(0, Math.round(minutes * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h ${rm}m`;
  return `${h}h ${rm}m`;
}

export function formatDueDate(
  followUpDate: string | null | undefined,
  opts?: { overdueFallback?: boolean; now?: Date }
): { label: string; overdue: boolean } {
  const now = opts?.now ?? new Date();
  if (!followUpDate) {
    if (opts?.overdueFallback) return { label: "Overdue", overdue: true };
    return { label: "Soon", overdue: false };
  }
  const d = new Date(followUpDate);
  const overdue = d.getTime() < now.getTime() && !isToday(d);
  if (overdue) {
    const days = differenceInCalendarDays(now, d);
    if (days <= 0) return { label: "Overdue", overdue: true };
    if (days === 1) return { label: "Overdue · 1 day", overdue: true };
    if (days < 14) return { label: `Overdue · ${days} days`, overdue: true };
    return { label: `Overdue since ${format(d, "d MMM")}`, overdue: true };
  }
  if (isToday(d)) return { label: `Today, ${format(d, "HH:mm")}`, overdue: false };
  if (isTomorrow(d)) return { label: "Tomorrow", overdue: false };
  return { label: format(d, "EEE, d MMM"), overdue: false };
}

function firstFormValue(
  formData: Record<string, unknown> | null | undefined,
  keyPattern: RegExp
): string | null {
  if (!formData) return null;
  for (const key of Object.keys(formData)) {
    if (!keyPattern.test(key)) continue;
    const v = formData[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length) return String(v[0]).trim() || null;
  }
  return null;
}

export function getLeadSubtitle(lead: {
  project_type?: string | null;
  source?: string | null;
  form_data?: Record<string, unknown> | null;
  qualifiers?: { target_locations?: string[] | null } | null;
}): string {
  const industry =
    lead.project_type?.trim() ||
    firstFormValue(lead.form_data, /service|project|industry|product|type/i);

  const location =
    lead.qualifiers?.target_locations?.[0]?.trim() ||
    firstFormValue(lead.form_data, /locat|city|suburb|area|town|address/i);

  const sourceRaw = (lead.source ?? "").toLowerCase();
  let sourceLabel: string | null = null;
  if (sourceRaw.includes("facebook") || sourceRaw.includes("meta") || sourceRaw === "fb") {
    sourceLabel = "Facebook Lead";
  } else if (sourceRaw.includes("whatsapp") || sourceRaw === "wa") {
    sourceLabel = "WhatsApp";
  } else if (sourceRaw.includes("refer")) {
    sourceLabel = "Referral";
  } else if (sourceRaw.includes("web") || sourceRaw.includes("site")) {
    sourceLabel = "Website";
  }

  const parts: string[] = [];
  if (industry) parts.push(industry);
  else if (sourceLabel) parts.push(sourceLabel);

  if (location) parts.push(location);
  else if (industry && sourceLabel) parts.push(sourceLabel);

  // Avoid "Service enquiry · —" and empty placeholders
  return parts.filter((p) => p && p !== "—").join(" · ");
}

export function getPipelineIndustry(lead: {
  project_type?: string | null;
  source?: string | null;
  form_data?: Record<string, unknown> | null;
}): string {
  const industry =
    lead.project_type?.trim() ||
    firstFormValue(lead.form_data, /service|project|industry|product|type/i);
  if (industry) return industry;
  const sourceRaw = (lead.source ?? "").toLowerCase();
  if (sourceRaw.includes("facebook") || sourceRaw.includes("meta")) return "Facebook Lead";
  if (sourceRaw.includes("whatsapp")) return "WhatsApp";
  if (sourceRaw.includes("solar")) return "Solar";
  return "Opportunity";
}

export function resolveNumericDealValue(lead: {
  deal_value?: number | null;
  budget?: string | null;
}): { amount: number | null; fromBudget: boolean } {
  const deal = lead.deal_value;
  if (typeof deal === "number" && Number.isFinite(deal)) {
    return { amount: deal, fromBudget: false };
  }
  if (lead.budget?.trim()) {
    const cleaned = lead.budget.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) return { amount: n, fromBudget: true };
  }
  return { amount: null, fromBudget: false };
}
