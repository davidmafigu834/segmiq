"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Megaphone, RefreshCw } from "lucide-react";
import { PulseBar } from "@/components/dashboard/PulseBar";
import { Button } from "@/components/ui/Button";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { aggregateCampaignPulse, type CampaignClientGroup } from "@/components/campaigns/campaign-helpers";
import type { FbCampaignsDatePreset } from "@/lib/facebook/campaigns";

type AllClient = { id: string; name: string };

type ApiResponse = {
  clients: CampaignClientGroup[];
  datePreset: FbCampaignsDatePreset;
};

async function fetchCampaigns(url: string): Promise<ApiResponse> {
  const r = await fetch(url);
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Failed to load campaigns");
  }
  return r.json();
}

function buildCampaignsQuery(selected: Set<string>, datePreset: FbCampaignsDatePreset): string {
  const p = new URLSearchParams();
  if (selected.size > 0) {
    for (const id of Array.from(selected)) p.append("clientId", id);
  }
  p.set("datePreset", datePreset);
  return p.toString();
}

export function CampaignsDashboard({ allClients }: { allClients: AllClient[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [datePreset, setDatePreset] = useState<FbCampaignsDatePreset>("last_30d");

  const swrKey = useMemo(
    () => `/api/campaigns?${buildCampaignsQuery(selected, datePreset)}`,
    [selected, datePreset]
  );

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetchCampaigns, { revalidateOnFocus: false });

  const pulse = useMemo(() => aggregateCampaignPulse(data?.clients ?? []), [data]);

  const onRefresh = () => {
    const u = new URL(swrKey, typeof window !== "undefined" ? window.location.origin : "http://local");
    u.searchParams.set("refresh", "1");
    void fetch(u.toString()).then(() => mutate());
  };

  const groups = data?.clients ?? [];
  const noAccountsConnected = !isLoading && !error && groups.length === 0;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-6 layout:flex-row layout:items-start layout:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Agency / Campaigns</p>
          <h1 className="font-display text-3xl leading-none tracking-display text-ink-primary sm:text-[40px]">Campaigns</h1>
          <p className="mt-2 text-[14px] text-ink-secondary">Live performance across all connected ad accounts</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 layout:items-end">
          <div className="-mx-1 flex flex-wrap items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className={`h-8 shrink-0 rounded-md px-3 text-[12px] font-medium transition-colors ${
                selected.size === 0
                  ? "border border-[var(--border-strong)] bg-[var(--bg-quaternary)] text-[var(--text-primary)]"
                  : "border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
              }`}
            >
              All clients
            </button>
            {allClients.map((c) => {
              const active = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(selected);
                    if (next.has(c.id)) next.delete(c.id);
                    else next.add(c.id);
                    setSelected(next);
                  }}
                  className={`h-8 shrink-0 rounded-md px-3 text-[12px] font-medium transition-colors ${
                    active
                      ? "border border-[var(--border-strong)] bg-[var(--bg-quaternary)] text-[var(--text-primary)]"
                      : "border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2">
            <select
              aria-label="Date range"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as FbCampaignsDatePreset)}
              className="input-base h-9 w-full text-sm sm:w-[140px]"
            >
              <option value="last_7d">Last 7 days</option>
              <option value="last_30d">Last 30 days</option>
              <option value="lifetime">Lifetime</option>
            </select>
            <Button variant="ghost" onClick={() => onRefresh()} title="Refresh data">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <p className="max-w-md text-right text-[11px] text-ink-tertiary">
            Select clients to filter. Empty selection shows all connected accounts.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-fg)]">
          {error instanceof Error ? error.message : "Error"}
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="shimmer h-[320px] rounded-xl" />
      ) : noAccountsConnected ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-card py-20 text-center">
          <Megaphone className="h-10 w-10 text-ink-tertiary" strokeWidth={1.5} />
          <h2 className="mt-6 font-display text-xl text-ink-primary">No ad accounts connected</h2>
          <p className="mt-2 max-w-md text-sm text-ink-secondary">
            Connect a client&apos;s Facebook account and choose an ad account to start seeing campaign performance here.
          </p>
          <Link href="/dashboard/clients" className="btn-primary mt-8">
            Go to Clients
          </Link>
        </div>
      ) : (
        <>
          <PulseBar metrics={pulse} />
          <div className="mt-8">
            <CampaignsTable
              groups={groups}
              facebookSettingsHref={(id) => `/dashboard/clients/${id}/facebook`}
            />
          </div>
        </>
      )}
    </div>
  );
}
