"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import type { PricingPresentation } from "@/lib/commercial/presentation";
import { formatUsd } from "@/lib/commercial/presentation";

export function PublicPricingCalculator({ presentation }: { presentation: PricingPresentation }) {
  const [seats, setSeats] = useState(5);
  const totals = useMemo(() => presentation.packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    total: pkg.seatPriceUsdCents * seats + pkg.organisationFeeUsdCents,
    organisationFee: pkg.organisationFeeUsdCents,
  })), [presentation, seats]);
  return (
    <section className="mx-auto mb-10 max-w-[900px] px-5" aria-labelledby="pricing-estimate-heading">
      <div className="rounded-2xl border border-current/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 id="pricing-estimate-heading" className="text-[20px] font-bold">Estimate your monthly subscription</h2><p className="mt-1 text-sm opacity-65">Every active internal user counts once. Agentic AI requires Growth seats plus its organisation fee.</p></div>
          <label className="w-full sm:w-40"><span className="mb-1.5 flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" aria-hidden="true" />Paid users</span><input className="min-h-11 w-full rounded-lg border border-current/20 bg-transparent px-3 text-base font-semibold" type="number" min={1} max={10000} value={seats} onChange={(event) => setSeats(Math.max(1, Number(event.target.value) || 1))} /></label>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{totals.map((item) => <div key={item.id} className="rounded-xl border border-current/10 p-4"><p className="text-xs font-semibold uppercase tracking-wide opacity-60">{item.name}</p><p className="mt-2 text-[24px] font-extrabold">{formatUsd(item.total)}</p><p className="mt-1 text-xs opacity-60">per month{item.organisationFee ? ", including AI fee" : ""}</p></div>)}</div>
        <p className="mt-4 text-xs leading-5 opacity-60">Estimate excludes one-time onboarding, taxes, discounts, and approved AI top-ups. Your quotation remains the authoritative commercial offer.</p>
      </div>
    </section>
  );
}
