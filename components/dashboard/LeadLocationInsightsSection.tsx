"use client";

import { useEffect, useState } from "react";
import { MapPin, Target, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

type LocationStat = {
  location: string;
  leads: number;
  sharePct: number;
  open: number;
  won: number;
  lost: number;
  notQualified: number;
};

type LocationAnalysis = {
  totalFacebookLeads: number;
  leadsWithLocation: number;
  coveragePct: number;
  uniqueLocations: number;
  topLocations: LocationStat[];
};

const WINDOWS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
] as const;

export function LeadLocationInsightsSection({
  clientId,
}: {
  clientId: string;
}) {
  const [days, setDays] = useState(90);
  const [analysis, setAnalysis] = useState<LocationAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/reports/client/locations?clientId=${clientId}&days=${days}`)
      .then((response) => response.json())
      .then((data: { analysis?: LocationAnalysis }) => {
        if (!cancelled && data.analysis) setAnalysis(data.analysis);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, days]);

  if (loading && !analysis) {
    return (
      <Card>
        <CardBody>
          <div className="h-[260px] animate-pulse rounded-xl bg-[var(--bg-quaternary)]" />
        </CardBody>
      </Card>
    );
  }

  if (!analysis) return null;

  const locations = analysis.topLocations.slice(0, 10);
  const maxLeads = Math.max(...locations.map((location) => location.leads), 1);
  const topLocation = locations[0] ?? null;

  return (
    <Card>
      <CardBody>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#60a5fa]" aria-hidden />
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                Facebook lead locations
              </p>
            </div>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Where ad-generated leads are coming from, merged case-insensitively.
            </p>
          </div>

          <div className="flex rounded-lg border border-[var(--border)] p-0.5">
            {WINDOWS.map((window) => (
              <button
                key={window.days}
                type="button"
                onClick={() => setDays(window.days)}
                className={`rounded-md px-2.5 py-1.5 text-[11px] transition ${
                  days === window.days
                    ? "bg-[var(--bg-quaternary)] font-semibold text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {window.label}
              </button>
            ))}
          </div>
        </div>

        {analysis.leadsWithLocation === 0 ? (
          <div className="py-8 text-center">
            <MapPin
              className="mx-auto mb-3 h-7 w-7 text-[var(--text-disabled)]"
              aria-hidden
            />
            <p className="m-0 text-[13px] text-[var(--text-secondary)]">
              No Facebook lead locations captured in this period.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Facebook leads
                </p>
                <p className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
                  {analysis.totalFacebookLeads.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Location coverage
                </p>
                <p className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
                  {analysis.coveragePct}%
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Locations
                </p>
                <p className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
                  {analysis.uniqueLocations.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Top location
                </p>
                <p className="mt-1 truncate text-[18px] font-semibold text-[var(--text-primary)]">
                  {topLocation?.location}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                  {topLocation?.leads.toLocaleString()} leads · {topLocation?.sharePct}%
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Top locations by lead volume
                </p>
                <div className="space-y-3">
                  {locations.map((location) => (
                    <div key={location.location}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="truncate text-[12px] text-[var(--text-secondary)]">
                          {location.location}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-[var(--text-tertiary)]">
                          {location.leads} · {location.sharePct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
                        <div
                          className="h-full rounded-full bg-[#60a5fa]"
                          style={{
                            width: `${Math.max(
                              3,
                              Math.round((location.leads / maxLeads) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Pipeline by location
                </p>
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-tertiary)]">
                        <th className="px-3 py-2 font-medium">Location</th>
                        <th className="px-2 py-2 text-right font-medium">Open</th>
                        <th className="px-2 py-2 text-right font-medium">Won</th>
                        <th className="px-3 py-2 text-right font-medium">Lost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((location) => (
                        <tr
                          key={location.location}
                          className="border-b border-[var(--border)] last:border-0"
                        >
                          <td className="max-w-32 truncate px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                            {location.location}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-[11px] text-[var(--text-secondary)]">
                            {location.open}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-[11px] text-[var(--success)]">
                            {location.won}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--text-tertiary)]">
                            {location.lost}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {topLocation ? (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-[rgba(96,165,250,0.2)] bg-[rgba(96,165,250,0.06)] px-4 py-3">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-[#60a5fa]" aria-hidden />
                <p className="m-0 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">
                    {topLocation.location} contributes {topLocation.sharePct}% of located
                    Facebook leads.
                  </strong>{" "}
                  Compare lead quality and sales capacity there before increasing or
                  reducing geographic ad spend.
                </p>
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Counts represent leads, not repeated calls or form submissions.
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
