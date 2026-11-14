"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Share2, Trophy } from "lucide-react";
import type { AgentFunnelItem, AgentProfile, FunnelTotals, RankingRow } from "@/lib/real-estate/funnels/service";
import { Avatar, btn, card, bigLime, ensureLink, funnelUrl, initialsOf, lime, PropertyThumb, StatusChip, useCopied } from "@/components/real-estate/funnels/agent/ui";
import { ShareSheet } from "@/components/real-estate/funnels/agent/ShareSheet";

type Props = {
  baseUrl: string;
  me: { name: string; first: string };
  agencyName: string;
  profile: AgentProfile | null;
  funnels: AgentFunnelItem[];
  others: AgentFunnelItem[];
  totals: FunnelTotals;
  latestLead: { leadId: string; listingId: string; name: string; createdAt: string; heading: string } | null;
  ranking: RankingRow[];
};

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function resultLine(item: AgentFunnelItem, ready: boolean): string {
  if (item.funnelStatus && item.funnelStatus !== "live") return "Your link appears here when the page goes live.";
  if (!ready) return "Ready to share once your link is set up.";
  const { visits, enquiries } = item.totals;
  if (!visits && !enquiries) return "Not shared yet. Visits from your link show here.";
  return `${visits} ${visits === 1 ? "visit" : "visits"} from your links · ${enquiries} ${enquiries === 1 ? "enquiry" : "enquiries"}`;
}

export function FunnelsHome({ baseUrl, me, agencyName, profile, funnels, others, totals, latestLead, ranking }: Props) {
  const [share, setShare] = useState<{ item: AgentFunnelItem; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const { copied, copy } = useCopied();
  const ready = Boolean(profile);

  async function linkFor(item: AgentFunnelItem): Promise<string | null> {
    if (!profile) return null;
    setBusy(item.listingId);
    setError(null);
    const result = await ensureLink(item.listingId);
    setBusy(null);
    if ("error" in result) {
      setError(`${item.heading}: ${result.error}`);
      return null;
    }
    return funnelUrl(baseUrl, result.slug, profile.handle);
  }

  async function onShare(item: AgentFunnelItem) {
    const url = await linkFor(item);
    if (url) setShare({ item, url });
  }

  async function onCopy(item: AgentFunnelItem) {
    const url = await linkFor(item);
    if (!url) return;
    await copy(item.listingId, url);
    setCopiedUrl(url);
  }

  function renderRow(item: AgentFunnelItem) {
    const shareable = !item.funnelStatus || item.funnelStatus === "live";
    return (
      <li key={item.listingId} className="flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3 first:border-t-0">
        <Link href={`/sales/funnels/${item.listingId}`} className="flex min-w-[220px] flex-1 items-center gap-3 text-left">
          <PropertyThumb src={item.imageUrl} className={`h-14 w-20 rounded-[8px] ${shareable ? "" : "opacity-60"}`} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold">{item.heading}</span>
              <StatusChip status={item.funnelStatus} />
            </span>
            <span className="block text-[12px] text-sales-text-muted">{[item.category, item.suburb !== item.heading ? item.suburb : null, item.priceLabel].filter(Boolean).join(" · ")}</span>
            <span className="mt-0.5 block text-[13px] text-sales-text-secondary">{resultLine(item, ready)}</span>
          </span>
        </Link>
        {shareable ? (
          <div className="flex gap-2">
            {ready ? (
              <>
                <button type="button" className={lime} disabled={busy === item.listingId} onClick={() => void onShare(item)}>
                  <Share2 size={14} strokeWidth={2} aria-hidden />
                  Share
                </button>
                <button type="button" className={btn} disabled={busy === item.listingId} onClick={() => void onCopy(item)}>
                  {copied === item.listingId ? "Copied" : "Copy link"}
                </button>
              </>
            ) : (
              <Link href="/sales/funnels/setup" className={btn}>Set up link</Link>
            )}
          </div>
        ) : (
          <Link href={`/sales/funnels/${item.listingId}`} className={btn}>Progress</Link>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Funnels</h1>
          <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">Property pages the SegmiQ team builds for {agencyName}. Every link you share carries your name and WhatsApp, so the buyer comes to you.</p>
        </div>
        {ready ? (
          <Link href="/sales/funnels/setup" className={btn}>
            <Avatar initials={initialsOf(me.name)} you size="sm" />
            Your link details
          </Link>
        ) : null}
      </header>

      {!ready ? (
        <section className={`${card} flex flex-wrap items-center gap-4 border-l-[3px] border-l-sales-brand px-4 py-4`} aria-labelledby="fn-setup">
          <Avatar initials={initialsOf(me.name)} you size="lg" />
          <div className="min-w-[200px] flex-1">
            <h2 id="fn-setup" className="text-[15px] font-semibold">Set up your funnel link first</h2>
            <p className="mt-1 text-[13px] text-sales-text-secondary">Choose your link name and the WhatsApp number buyers reach. You do this once and it applies to every property.</p>
          </div>
          <Link href="/sales/funnels/setup" className={bigLime}>Set up my link</Link>
        </section>
      ) : latestLead ? (
        <section className="flex flex-wrap items-center gap-3 rounded-[12px] bg-sales-text-primary px-4 py-3 text-sales-surface" aria-label="Latest enquiry">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-sales-brand text-sales-brand-text" aria-hidden>
            <Bell size={16} strokeWidth={2} />
          </span>
          <div className="min-w-[180px] flex-1">
            <p className="text-[14px] font-semibold">New enquiry from {latestLead.name}</p>
            <p className="text-[13px] opacity-80">{latestLead.heading} · {ago(latestLead.createdAt)}</p>
          </div>
          <Link href={`/sales/leads?lead=${latestLead.leadId}`} className={lime}>Open lead</Link>
        </section>
      ) : null}

      {error ? <p className="rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2 text-[13px] font-medium text-sales-danger-fg" role="alert">{error}</p> : null}

      <div className="grid items-start gap-x-4 gap-y-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.85fr)]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="fn-list">
            <h2 id="fn-list" className="mb-3 flex items-center gap-2 font-display text-[18px] font-semibold leading-tight tracking-[-0.02em]">
              Funnels
              <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-sales-border bg-sales-surface px-1.5 font-sans text-[12px] font-semibold tabular-nums tracking-normal">{funnels.length}</span>
            </h2>
            {funnels.length ? (
              <ul className={`${card} overflow-hidden`}>
                {funnels.map(renderRow)}
              </ul>
            ) : (
              <p className={`${card} px-4 py-4 text-[13px] text-sales-text-secondary`}>No funnel pages yet. When the SegmiQ team publishes one for {agencyName}, it appears here with your link ready.</p>
            )}
          </section>

          {others.length ? (
            <section aria-labelledby="fn-others">
              <h2 id="fn-others" className="mb-1 font-display text-[18px] font-semibold leading-tight tracking-[-0.02em]">Other properties</h2>
              <p className="mb-3 text-[13px] text-sales-text-muted">No funnel yet. Your link opens the standard property page, with your enquiries tracked the same way.</p>
              <ul className={`${card} overflow-hidden`}>
                {others.map(renderRow)}
              </ul>
            </section>
          ) : null}
          {copiedUrl && copied ? <p className="text-[13px] text-sales-text-secondary" role="status">Copied {copiedUrl}</p> : null}
        </div>

        <div className="space-y-6">
          <section className={`${card} px-4 py-4`} aria-labelledby="fn-totals">
            <h2 id="fn-totals" className="text-[15px] font-semibold">Your links, last 30 days</h2>
            {!ready ? <p className="mt-1 text-[12px] text-sales-text-muted">Counts start when you share your first link.</p> : null}
            <dl className="mt-3 grid grid-cols-2 gap-4">
              {([
                ["Visits", totals.visits],
                ["WhatsApp taps", totals.whatsapp],
                ["Enquiries", totals.enquiries],
                ["Viewing requests", totals.viewings],
              ] as const).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[12px] text-sales-text-muted">{label}</dt>
                  <dd className="mt-1 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={`${card} overflow-hidden`} aria-labelledby="fn-rank">
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
              <Trophy size={16} strokeWidth={2} aria-hidden className="text-sales-text-muted" />
              <h2 id="fn-rank" className="text-[15px] font-semibold">Agency ranking</h2>
            </div>
            <p className="px-4 text-[12px] text-sales-text-muted">Enquiries and viewing requests from agent links, last 30 days</p>
            <ol className="mt-2">
              {ranking.map((row, index) => (
                <li key={row.agentId} className={`flex items-center gap-3 border-t border-sales-border-subtle px-4 py-2.5 ${row.you ? "bg-sales-surface-active" : ""}`}>
                  <span className="w-4 text-[13px] font-semibold tabular-nums text-sales-text-muted">{index + 1}</span>
                  <Avatar initials={row.initials} you={row.you} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{row.you ? `${row.name} (you)` : row.name}</span>
                    <span className="block text-[12px] text-sales-text-muted">{row.visits} {row.visits === 1 ? "visit" : "visits"}</span>
                  </span>
                  <span className="text-[18px] font-semibold tabular-nums">{row.enquiries}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {share && profile ? (
        <ShareSheet
          property={{ listingId: share.item.listingId, heading: share.item.heading, suburb: share.item.suburb, priceLabel: share.item.priceLabel, imageUrl: share.item.imageUrl, shareTitle: share.item.shareTitle, shareSummary: share.item.shareSummary }}
          me={me}
          agencyName={agencyName}
          url={share.url}
          onClose={() => setShare(null)}
        />
      ) : null}
    </div>
  );
}
