"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Priority = { id: string; title: string; detail: string; action: string };

export function BuyerSearchPriorities({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Priority[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/clients/${clientId}/buyer-reports`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setItems((json?.priorities as Priority[] | undefined) ?? []);
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
    <section className="rounded-lg border border-sales-border bg-sales-surface">
      <div className="flex items-center justify-between gap-3 border-b border-sales-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-sales-text-primary">Buyer and tenant priorities</h2>
        <Link href="/sales/buyers" className="text-xs font-medium text-sales-text-secondary">
          Open workspace
        </Link>
      </div>
      <ul className="divide-y divide-sales-border-subtle">
        {items.slice(0, 6).map((item) => {
          const searchId = item.id.startsWith("follow-")
            ? item.id.slice("follow-".length)
            : item.id.startsWith("match-")
              ? item.id.slice("match-".length)
              : null;
          const href = searchId
            ? `/sales/buyers/${searchId}`
            : item.id.startsWith("offer-")
              ? "/sales/offers"
              : "/sales/viewings";
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sales-text-primary">{item.title}</p>
                <p className="truncate text-xs text-sales-text-secondary">{item.detail}</p>
              </div>
              <Link href={href} className="inline-flex min-h-9 shrink-0 items-center text-xs font-semibold">
                {item.action}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
