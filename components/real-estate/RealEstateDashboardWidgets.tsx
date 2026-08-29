"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Calendar, Tag } from "lucide-react";

type Stats = {
  activeListings: number;
  viewingsThisWeek: number;
  underOffer: number;
};

export function RealEstateDashboardWidgets({ clientId }: { clientId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const [listRes, viewRes, underRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/listings?status=available`),
        fetch(
          `/api/clients/${clientId}/viewings?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`
        ),
        fetch(`/api/clients/${clientId}/listings?status=under_offer`),
      ]);

      const listJson = (await listRes.json()) as { listings?: unknown[] };
      const viewJson = (await viewRes.json()) as { viewings?: { status: string }[] };
      const underJson = (await underRes.json()) as { listings?: unknown[] };

      if (!cancelled) {
        setStats({
          activeListings: listJson.listings?.length ?? 0,
          viewingsThisWeek: (viewJson.viewings ?? []).filter((v) => v.status === "scheduled").length,
          underOffer: underJson.listings?.length ?? 0,
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
      href: "/client/viewings",
    },
    {
      label: "Properties Under Offer",
      value: stats?.underOffer ?? "—",
      icon: Tag,
      href: "/client/listings",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5 transition hover:border-sales-border-strong"
        >
          <div className="flex items-center gap-2 text-sales-text-secondary">
            <c.icon className="h-4 w-4" />
            <span className="font-mono text-[11px] uppercase tracking-wider">{c.label}</span>
          </div>
          <p className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-sales-text-primary">{c.value}</p>
        </Link>
      ))}
    </div>
  );
}
