"use client";

import { useState } from "react";

type Share = { id: string; publicUrl?: string; status?: string; campaignLabel?: string | null };

export function MarketThisProperty({ clientId, listingId, analyticsBase = "/sales/shared-listings" }: { clientId: string; listingId: string; analyticsBase?: string }) {
  const [share, setShare] = useState<Share | null>(null);
  const [caption, setCaption] = useState("");
  const [campaign, setCampaign] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generate(label?: string) {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/clients/${clientId}/listing-shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, campaignLabel: label || null }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string; share?: Share; caption?: string };
    setPending(false);
    if (!response.ok || !json.share) {
      setMessage(json.error ?? "Could not create a link");
      return;
    }
    setShare(json.share);
    setCaption(json.caption ?? "");
  }

  async function copy() {
    if (!share?.publicUrl) return;
    await navigator.clipboard.writeText(share.publicUrl);
    setMessage("Link copied");
  }

  async function shareNative() {
    if (!share?.publicUrl) return;
    const payload = { title: "Property", text: caption, url: share.publicUrl };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* dismissed */
      }
    }
    const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${caption}\n${share.publicUrl}`)}`;
    window.open(whatsapp, "_blank", "noopener,noreferrer");
  }

  async function revoke() {
    if (!share?.id) return;
    const response = await fetch(`/api/clients/${clientId}/listing-shares/${share.id}/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (response.ok) {
      setShare({ ...share, status: "revoked" });
      setMessage("Link revoked. Past enquiries stay in SegmiQ.");
    }
  }

  return (
    <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5">
      <h2 className="text-[18px] font-semibold text-sales-text-primary">Market this property</h2>
      <p className="mt-1 text-[13px] text-sales-text-secondary">Create your personal link. The agency keeps the listing. You keep the attribution.</p>
      {!share ? (
        <button type="button" disabled={pending} className="mt-3 inline-flex h-10 items-center rounded-[10px] bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-text" onClick={() => void generate()}>
          {pending ? "Preparing" : "Generate my listing link"}
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="break-all text-[13px] text-sales-text-primary">{share.publicUrl}</p>
          {caption ? <p className="text-[13px] text-sales-text-secondary">{caption}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-10 items-center rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text" onClick={() => void copy()}>Copy link</button>
            <button type="button" className="inline-flex h-10 items-center rounded-[10px] border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void shareNative()}>Share</button>
            <a className="inline-flex h-10 items-center rounded-[10px] border border-sales-border px-3 text-[13px] font-semibold" href={`${analyticsBase}/${share.id}`}>Analytics</a>
            {share.status !== "revoked" ? <a className="inline-flex h-10 items-center px-2 text-[13px]" href={`/api/clients/${clientId}/listing-shares/${share.id}/qr`}>QR code</a> : null}
            {share.status !== "revoked" ? <button type="button" className="inline-flex h-10 items-center px-2 text-[13px] text-sales-text-secondary" onClick={() => void revoke()}>Revoke link</button> : null}
          </div>
          <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void generate(campaign); }}>
            <input value={campaign} onChange={(event) => setCampaign(event.target.value)} maxLength={40} placeholder="Campaign label, optional" className="h-10 min-w-0 flex-1 rounded-[10px] border border-sales-border bg-transparent px-3 text-[13px]" />
            <button type="submit" className="h-10 rounded-[10px] border border-sales-border px-3 text-[13px] font-semibold">Add campaign link</button>
          </form>
        </div>
      )}
      {message ? <p className="mt-3 text-[13px] text-sales-text-secondary">{message}</p> : null}
    </section>
  );
}
