"use client";

import { useEffect, useState } from "react";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";

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

  return (
    <div className="dashboard-group mb-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
      <CompanyKpiCard
        item={{
          id: "listings",
          label: "Active listings",
          value: stats ? String(stats.activeListings) : "—",
          supporting: "Available stock",
          icon: "companies",
          href: "/client/listings",
        }}
      />
      <CompanyKpiCard
        item={{
          id: "viewings",
          label: "Viewings this week",
          value: stats ? String(stats.viewingsThisWeek) : "—",
          supporting: "Scheduled",
          icon: "followups",
          href: "/client/viewings",
        }}
      />
      <CompanyKpiCard
        item={{
          id: "under-offer",
          label: "Under offer",
          value: stats ? String(stats.underOffer) : "—",
          supporting: "Properties",
          icon: "deals",
          href: "/client/listings",
        }}
      />
    </div>
  );
}
