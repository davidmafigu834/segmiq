"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { id: string; title: string; reason: string; href: string };

export function AgencyAttention({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/clients/${clientId}/agency?view=attention`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setItems(json?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!items || items.length === 0) return null;

  return (
    <section className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
      <h2 className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">Needs your attention</h2>
      <ul className="divide-y divide-[var(--border)]">
        {items.slice(0, 8).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.title}</p>
              <p className="truncate text-xs text-[var(--text-secondary)]">{item.reason}</p>
            </div>
            <Link href={item.href} className="inline-flex min-h-9 shrink-0 items-center text-xs font-semibold">Open</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
