import Link from "next/link";
import { Building2 } from "lucide-react";
import { ClientCard } from "./ClientCard";
import type { ClientPerfRow } from "@/lib/dashboard-data";

export function ClientPerformanceGrid({ rows }: { rows: ClientPerfRow[] }) {
  return (
    <section className="mt-12">
      <div className="mb-5 flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-end min-[640px]:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            03 / PORTFOLIO
          </p>
          <h2 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">
            Client performance
          </h2>
        </div>
        <Link
          href="/dashboard/clients"
          className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          View all clients →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="mb-3 h-8 w-8 text-[var(--text-disabled)]" />
          <p className="mb-1 text-[14px] font-semibold text-[var(--text-secondary)]">No clients yet</p>
          <p className="text-[12px] text-[var(--text-tertiary)]">Add your first client to start tracking leads and performance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 layout:grid-cols-3">
          {rows.map((r) => (
            <ClientCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}
