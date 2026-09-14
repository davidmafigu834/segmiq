import Link from "next/link";
import { Building2 } from "lucide-react";
import { ClientCard } from "./ClientCard";
import { NewClientButton } from "@/components/dashboard/NewClientButton";
import type { ClientPerfRow } from "@/lib/dashboard-data";

export function ClientPerformanceGrid({ rows }: { rows: ClientPerfRow[] }) {
  return (
    <section className="mt-12 border-t border-[var(--border-strong)] pt-8">
      <div className="mb-5 flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-end min-[640px]:justify-between">
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Client performance
        </h2>
        <Link
          href="/dashboard/clients"
          className="whitespace-nowrap rounded-sm text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
        >
          View all clients →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="mb-3 h-8 w-8 text-[var(--text-disabled)]" />
          <p className="mb-1 text-[14px] font-semibold text-[var(--text-secondary)]">No clients yet</p>
          <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">Add your first client to start tracking leads and performance.</p>
          <NewClientButton />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border-strong)]">
          {rows.map((r) => (
            <ClientCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}
