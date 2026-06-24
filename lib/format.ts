/** Renders minutes as a compact duration (e.g. 4m 12s, 1h 20m). */
export function formatDuration(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return "—";
  }
  const totalSec = Math.round(totalMinutes * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

/** Relative time: 45s ago, 2m ago, 3h ago, 2d ago, or Apr 16. */
export function formatTimeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatCurrencyUsd(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    amount
  );
}

/** Deal value in thousands for pulse bar, e.g. $95K. */
export function formatThousandsK(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  const k = value / 1000;
  if (k < 1) return formatCurrencyUsd(value);
  const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
  return `$${rounded}K`;
}

/** Compact currency for hero tiles: full under $10k, $480K mid, $1.2M over $1M. */
export function formatCompactCurrency(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs < 10_000) return formatCurrencyUsd(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    const rounded = Math.round(m * 10) / 10;
    const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `$${s}M`;
  }
  const k = n / 1000;
  const rounded = Math.abs(k) >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
  return `$${rounded}K`;
}

/** Name from a Supabase embedded `leads(...)` join (object or one-element array). */
export function leadJoinName(
  leads: { name?: string | null } | { name?: string | null }[] | null | undefined
): string | null {
  if (!leads) return null;
  if (Array.isArray(leads)) return leads[0]?.name ?? null;
  return leads.name ?? null;
}
