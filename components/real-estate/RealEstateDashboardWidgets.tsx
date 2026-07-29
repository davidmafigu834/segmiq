"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Calendar, Handshake } from "lucide-react";

type Stats = {
  activeListings: number;
  viewingsThisWeek: number;
  offersPending: number;
};

export function RealEstateDashboardWidgets({ clientId }: { clientId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // week start Sunday-ish; fine for "this week"
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const [listRes, viewRes, leadRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/listings?status=available`),
        fetch(
          `/api/clients/${clientId}/viewings?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`
        ),
        fetch(`/api/clients/${clientId}/leads?offer_pending=1`).catch(() => null),
      ]);

      const listJson = (await listRes.json()) as { listings?: unknown[] };
      const viewJson = (await viewRes.json()) as { viewings?: { status: string }[] };
      let offersPending = 0;
      if (leadRes && leadRes.ok) {
        const leadJson = (await leadRes.json()) as { count?: number; leads?: unknown[] };
        offersPending = leadJson.count ?? leadJson.leads?.length ?? 0;
      } else {
        // Fallback: count from listings under_offer
        const under = await fetch(`/api/clients/${clientId}/listings?status=under_offer`);
        const underJson = (await under.json()) as { listings?: unknown[] };
        offersPending = underJson.listings?.length ?? 0;
      }

      if (!cancelled) {
        setStats({
          activeListings: listJson.listings?.length ?? 0,
          viewingsThisWeek: (viewJson.viewings ?? []).filter((v) => v.status === "scheduled").length,
          offersPending,
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const cards = [
    {
      label: "Active listings",
      value: stats?.activeListings ?? "—",
      icon: Building2,
      href: "/client/listings",
    },
    {
      label: "Viewings this week",
      value: stats?.viewingsThisWeek ?? "—",
      icon: Calendar,
      href: "/client/listings",
    },
    {
      label: "Offers pending",
      value: stats?.offersPending ?? "—",
      icon: Handshake,
      href: "/client/leads",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 transition hover:border-[var(--border-hover)]"
        >
          <div className="flex items-center gap-2 text-ink-secondary">
            <c.icon className="h-4 w-4" />
            <span className="font-mono text-[11px] uppercase tracking-wider">{c.label}</span>
          </div>
          <p className="mt-2 font-display text-3xl">{c.value}</p>
        </Link>
      ))}
    </div>
  );
}
