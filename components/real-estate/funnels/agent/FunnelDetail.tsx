"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, ExternalLink, Link2, Plus, Share2 } from "lucide-react";
import type { AgentFunnelItem, AgentProfile, ChannelLink } from "@/lib/real-estate/funnels/service";
import { Avatar, btn, card, ensureLink, funnelUrl, initialsOf, lime, LinkText, PropertyThumb, StatusChip, useCopied } from "@/components/real-estate/funnels/agent/ui";
import { ShareSheet } from "@/components/real-estate/funnels/agent/ShareSheet";

type Lead = {
  leadId: string;
  name: string;
  status: string;
  kind: "enquiry" | "viewing_request";
  createdAt: string;
  channel: string | null;
  message: string | null;
};

type Props = {
  baseUrl: string;
  me: { name: string; first: string };
  agencyName: string;
  listing: AgentFunnelItem;
  available: boolean;
  profile: AgentProfile | null;
  channels: ChannelLink[];
  leads: Lead[];
};

const back = (
  <Link href="/sales/funnels" className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
    <ArrowLeft size={14} strokeWidth={2} aria-hidden />
    Funnels
  </Link>
);

function when(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function leadStatus(status: string): string {
  const map: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", WON: "Won", LOST: "Lost" };
  return map[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

export function FunnelDetail({ baseUrl, me, agencyName, listing, available, profile, channels: initialChannels, leads }: Props) {
  const [share, setShare] = useState<string | null>(null);
  const [channels, setChannels] = useState(initialChannels);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState(listing.slug);
  const { copied, copy } = useCopied();
  const handle = profile?.handle ?? "";
  const mainUrl = slug && handle ? funnelUrl(baseUrl, slug, handle) : null;
  const maxVisits = Math.max(1, ...channels.map((channel) => channel.totals.visits));

  async function ready(): Promise<string | null> {
    setError(null);
    const result = await ensureLink(listing.listingId);
    if ("error" in result) {
      setError(result.error);
      return null;
    }
    setSlug(result.slug);
    return result.slug;
  }

  async function copyLink(key: string, channel?: string) {
    const current = channel && slug ? slug : await ready();
    if (!current || !handle) return;
    await copy(key, funnelUrl(baseUrl, current, handle, channel));
  }

  async function openShare() {
    const current = await ready();
    if (current && handle) setShare(funnelUrl(baseUrl, current, handle));
  }

  async function addChannel(event: FormEvent) {
    event.preventDefault();
    const label = (adding ?? "").trim();
    if (!label) return setAddError("Name the channel, for example LinkedIn.");
    const response = await fetch(`/api/sales/funnels/${listing.listingId}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const body = (await response.json().catch(() => ({}))) as { channel?: ChannelLink; error?: string };
    if (!response.ok || !body.channel) return setAddError(body.error ?? "Could not add the channel.");
    setChannels((rows) => [...rows, body.channel!]);
    if (!slug) await ready();
    setAdding(null);
    setAddError(null);
  }

  if (listing.funnelStatus && listing.funnelStatus !== "live") {
    const stage = listing.funnelStatus === "review" ? 2 : 1;
    const steps = ["Brief and photos received", "SegmiQ team writes the copy and designs the page", `${agencyName} approves the page`, "Goes live, and your link appears"];
    return (
      <div className="space-y-5">
        {back}
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">{[listing.category, listing.suburb].filter(Boolean).join(" · ")}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{listing.heading} <StatusChip status={listing.funnelStatus} /></h1>
          <p className="mt-2 max-w-[60ch] text-[14px] text-sales-text-secondary">
            {listing.funnelStatus === "paused" ? "This page is paused. Links to it show the standard property page until it is back." : "The SegmiQ team is building this page. When it goes live it shows up in Funnels with your link ready."}
          </p>
        </header>
        {listing.funnelStatus !== "paused" ? (
          <ol className={`${card} overflow-hidden`}>
            {steps.map((label, index) => {
              const state = index < stage ? "done" : index === stage ? "now" : "next";
              return (
                <li key={label} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3 first:border-t-0">
                  <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${state === "done" ? "bg-sales-text-primary text-sales-brand" : state === "now" ? "border-2 border-sales-text-primary" : "border border-sales-border"}`} aria-hidden>
                    {state === "done" ? <Check size={13} strokeWidth={2.5} /> : null}
                  </span>
                  <span className={`text-[14px] ${state === "next" ? "text-sales-text-muted" : "font-semibold"}`}>{label}</span>
                  {state === "now" ? <span className="ml-auto text-[12px] text-sales-text-muted">In progress</span> : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}

      <header className="grid items-end gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <PropertyThumb src={listing.imageUrl} className="aspect-[16/10] w-full rounded-[12px]" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">{[listing.category, listing.suburb !== listing.heading ? listing.suburb : null].filter(Boolean).join(" · ")}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{listing.heading} <StatusChip status={listing.funnelStatus} /></h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">
            {[listing.priceLabel, listing.funnelStatus === "live" && listing.publishedAt ? `Live since ${new Date(listing.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : null, listing.funnelStatus === "live" ? "Built by the SegmiQ team" : "Standard property page"].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      {error ? <p className="rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2 text-[13px] font-medium text-sales-danger-fg" role="alert">{error}</p> : null}

      <div className="grid items-start gap-x-4 gap-y-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className={`${card} px-4 py-4`} aria-labelledby="fn-mylink">
            <h2 id="fn-mylink" className="text-[15px] font-semibold">Your link</h2>
            {!available ? (
              <p className="mt-2 text-[13px] text-sales-text-secondary">This property is not available, so it cannot be shared.</p>
            ) : profile ? (
              <>
                <p className="mt-3 flex items-start gap-2 rounded-[8px] border border-dashed border-sales-border bg-sales-bg px-3 py-2.5 text-[13px]">
                  <Link2 size={15} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-sales-text-muted" />
                  <LinkText url={mainUrl ?? funnelUrl(baseUrl, "…", handle)} handle={handle} />
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={lime} onClick={() => void openShare()}>
                    <Share2 size={14} strokeWidth={2} aria-hidden />
                    Share
                  </button>
                  <button type="button" className={btn} onClick={() => void copyLink("main")}>
                    <Copy size={14} strokeWidth={2} aria-hidden />
                    {copied === "main" ? "Copied" : "Copy"}
                  </button>
                  {mainUrl ? (
                    <a className={btn} href={mainUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} strokeWidth={2} aria-hidden />
                      See it as a buyer
                    </a>
                  ) : null}
                </div>
                <p className="mt-3 text-[12px] text-sales-text-muted">Buyers who open this link see your name and WhatsApp on the page. Their enquiries come to you.</p>
              </>
            ) : (
              <div className="mt-2">
                <p className="text-[13px] text-sales-text-secondary">You haven&apos;t set up your funnel link yet.</p>
                <Link href="/sales/funnels/setup" className={`${lime} mt-3`}>Set up my link</Link>
              </div>
            )}
          </section>

          {profile && available ? (
            <section className={`${card} overflow-hidden`} aria-labelledby="fn-channels">
              <div className="px-4 pb-2 pt-4">
                <h2 id="fn-channels" className="text-[15px] font-semibold">Links by channel</h2>
                <p className="mt-1 text-[12px] text-sales-text-muted">Use a different link on each channel to see which one brings you buyers.</p>
              </div>
              <ul>
                {channels.map((channel) => (
                  <li key={channel.shareId} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">{channel.label}</span>
                      <span className="block text-[12px] text-sales-text-muted">
                        <LinkText url={funnelUrl(baseUrl, slug ?? "…", handle, channel.segment)} handle={handle} />
                      </span>
                    </span>
                    <button type="button" className={btn} onClick={() => void copyLink(channel.shareId, channel.segment)}>{copied === channel.shareId ? "Copied" : "Copy"}</button>
                  </li>
                ))}
              </ul>
              {adding == null ? (
                <button type="button" onClick={() => setAdding("")} className="flex w-full items-center gap-2 border-t border-sales-border-subtle px-4 py-3 text-left text-[13px] font-semibold text-sales-text-secondary transition-colors hover:bg-sales-surface-hover">
                  <Plus size={15} strokeWidth={2} aria-hidden />
                  Add a channel link
                </button>
              ) : (
                <form onSubmit={addChannel} className="border-t border-sales-border-subtle px-4 py-3">
                  <label className="block text-[13px] font-medium" htmlFor="fn-new-channel">Channel name</label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <input id="fn-new-channel" autoFocus value={adding} onChange={(event) => { setAdding(event.target.value); setAddError(null); }} placeholder="LinkedIn" maxLength={40} className="h-9 min-w-[140px] flex-1 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px]" />
                    <button type="submit" className={lime}>Add</button>
                    <button type="button" className={btn} onClick={() => { setAdding(null); setAddError(null); }}>Cancel</button>
                  </div>
                  {addError ? <p className="mt-1.5 text-[12px] font-medium text-sales-danger-fg">{addError}</p> : null}
                </form>
              )}
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <section className={`${card} px-4 py-4`} aria-labelledby="fn-results">
            <h2 id="fn-results" className="text-[15px] font-semibold">Your results, last 30 days</h2>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              {([
                ["Visits", listing.totals.visits],
                ["WhatsApp taps", listing.totals.whatsapp],
                ["Enquiries", listing.totals.enquiries],
                ["Viewing requests", listing.totals.viewings],
              ] as const).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[12px] text-sales-text-muted">{label}</dt>
                  <dd className="mt-1 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em]">{value}</dd>
                </div>
              ))}
            </dl>
            {channels.length ? (
              <ul className="mt-4 space-y-3 border-t border-sales-border-subtle pt-3">
                {channels.map((channel) => (
                  <li key={channel.shareId}>
                    <div className="flex justify-between gap-3 text-[13px]">
                      <span className="font-medium">{channel.label}</span>
                      <span className="tabular-nums text-sales-text-muted">{channel.totals.visits} visits · {channel.totals.enquiries} enq.</span>
                    </div>
                    <span className="mt-1 block h-1 rounded-full bg-sales-text-primary" style={{ width: `${Math.max(2, (channel.totals.visits / maxVisits) * 100)}%` }} aria-hidden />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className={`${card} overflow-hidden`} aria-labelledby="fn-leads">
            <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
              <h2 id="fn-leads" className="text-[15px] font-semibold">Leads from your links</h2>
              <span className="text-[13px] tabular-nums text-sales-text-muted">{leads.length}</span>
            </div>
            {leads.length ? (
              <ul>
                {leads.map((lead) => (
                  <li key={`${lead.leadId}:${lead.kind}`} className="border-t border-sales-border-subtle">
                    <Link href={`/sales/leads?lead=${lead.leadId}`} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-sales-surface-hover">
                      <Avatar initials={initialsOf(lead.name)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{lead.name}</span>
                        <span className="block text-[12px] text-sales-text-muted">
                          {[lead.kind === "viewing_request" ? "Viewing request" : "Enquiry", lead.channel ? `${lead.channel} link` : "Main link", when(lead.createdAt)].join(" · ")}
                        </span>
                        {lead.message ? <span className="mt-1 block line-clamp-2 text-[13px] text-sales-text-secondary">{lead.message}</span> : null}
                      </span>
                      <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-sales-border px-2 text-[12px] font-semibold">{leadStatus(lead.status)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-sales-border-subtle px-4 py-3 text-[13px] text-sales-text-muted">No leads from your links yet. Enquiries from this page land in Inquiries, assigned to you.</p>
            )}
          </section>
        </div>
      </div>

      {share && profile ? (
        <ShareSheet
          property={{ listingId: listing.listingId, heading: listing.heading, suburb: listing.suburb, priceLabel: listing.priceLabel, imageUrl: listing.imageUrl, shareTitle: listing.shareTitle, shareSummary: listing.shareSummary }}
          me={me}
          agencyName={agencyName}
          url={share}
          onClose={() => setShare(null)}
        />
      ) : null}
    </div>
  );
}
