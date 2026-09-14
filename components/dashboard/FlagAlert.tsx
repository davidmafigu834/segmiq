import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { UncontactedFlagRow } from "@/lib/dashboard-data";

export function FlagAlert({ rows, totalCount, href }: { rows: UncontactedFlagRow[]; totalCount: number; href: string }) {
  if (!rows.length || totalCount === 0) return null;
  const top = rows[0]!;
  const rest = rows.slice(1);
  const remainder =
    rest.length > 0
      ? rest.length === 1
        ? ` and ${rest[0]!.clientName} has ${rest[0]!.count}`
        : ` and ${rest.length} more clients`
      : "";

  const text = `${totalCount} leads uncontacted over limit — ${top.clientName} has ${top.count}${remainder}`;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-muted)] px-4 py-3 min-[520px]:px-5">
      <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--error)]" strokeWidth={1.5} aria-hidden />
      <p className="min-w-0 flex-1 text-[12px] text-[var(--error)]">{text}</p>
      <Link
        href={href}
        className="shrink-0 whitespace-nowrap rounded-sm text-[12px] font-medium text-[var(--error)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
      >
        Review →
      </Link>
    </div>
  );
}
