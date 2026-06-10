"use client";

import Link from "next/link";
import { ClientAvatar } from "@/components/ClientAvatar";
import { NewClientButton } from "@/components/dashboard/NewClientButton";

export type ClientsPageListRow = { id: string; name: string; industry: string };

export function ClientsPageClient({ clients }: { clients: ClientsPageListRow[] }) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <NewClientButton />
      </div>
      <div className="grid gap-4 md:grid-cols-2 layout:grid-cols-3">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/clients/${c.id}`}
            className="ag-card-hover group flex items-center gap-4 border border-[var(--ag-border)] bg-surface-card p-5 rounded-lg"
          >
            <ClientAvatar name={c.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[var(--ag-text-primary)]" style={{ fontFamily: "var(--ag-font-body)" }}>{c.name}</div>
              <div className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--ag-text-tertiary)]" style={{ fontFamily: "var(--ag-font-body)" }}>{c.industry}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
