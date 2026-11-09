"use client";

import { useState } from "react";
import { Phone } from "lucide-react";

function frame(body: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">${body}</svg>`)}`;
}

const PHOTOS = [
  {
    label: "Street",
    src: frame(`<rect width="800" height="500" fill="#d7cfc3"/><rect y="340" width="800" height="160" fill="#c4b8a8"/><rect x="170" y="150" width="460" height="230" fill="#efeae3"/><path d="M140 190 L400 70 L660 190" fill="#2f3a32"/><rect x="360" y="250" width="80" height="130" fill="#c8bfb2"/><rect x="230" y="210" width="70" height="55" fill="#9eb0b8"/><rect x="500" y="210" width="70" height="55" fill="#9eb0b8"/>`),
  },
  {
    label: "Living room",
    src: frame(`<rect width="800" height="500" fill="#efeae3"/><rect y="360" width="800" height="140" fill="#cbbfae"/><rect x="80" y="80" width="280" height="200" fill="#d5e0e4"/><rect x="420" y="250" width="280" height="110" fill="#8d9a86"/><rect x="460" y="220" width="90" height="50" fill="#efeae3"/>`),
  },
  {
    label: "Garden",
    src: frame(`<rect width="800" height="500" fill="#e7efe4"/><rect y="300" width="800" height="200" fill="#b7c7a4"/><circle cx="180" cy="230" r="70" fill="#6e8a62"/><rect x="168" y="280" width="24" height="70" fill="#6a5644"/><rect x="480" y="160" width="220" height="150" fill="#efeae3"/><path d="M460 190 L590 90 L720 190" fill="#2f3a32"/>`),
  },
];

export function PropertyRecord({ loading }: { loading: boolean }) {
  const [slot, setSlot] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [photo, setPhoto] = useState(0);

  async function copyViewing() {
    const when = slot ? new Date(slot).toLocaleString() : "the next open time";
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/f/viewing/2-baines`);
    } catch {
      /* The notice still confirms the form is ready. */
    }
    setNotice(`Viewing form copied for ${when}. Send it to the buyer.`);
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-hidden>
        <span className="re-bone block h-8 w-64 rounded-[6px]" />
        <span className="re-bone block h-40 rounded-[12px]" />
        <span className="re-bone block h-24 rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="re-in space-y-5">
      <header>
        <p className="text-[13px] font-medium text-sales-text-muted">David Mafigu</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">2 Baines Avenue</h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">Avondale, Harare · House · For sale</p>
        <p className="mt-1 text-[13px] text-sales-text-muted">On the market · US$185,000 · 4 bed · 2 bath · 220 m²</p>
      </header>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Photographs</h2>
          <p className="text-[13px] tabular-nums text-sales-text-muted">{photo + 1} / {PHOTOS.length}</p>
        </div>
        <div className="relative mt-3 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <img src={PHOTOS[photo].src} alt={PHOTOS[photo].label} className="aspect-[16/10] w-full object-cover" />
          <p className="absolute bottom-3 left-3 rounded-[8px] bg-sales-surface px-2 py-1 text-[12px] font-medium">{PHOTOS[photo].label}</p>
          <div className="absolute bottom-3 right-3 hidden gap-2 min-[480px]:flex">
            <button type="button" aria-label="Previous photograph" onClick={() => setPhoto((value) => (value + PHOTOS.length - 1) % PHOTOS.length)} className="h-9 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Previous</button>
            <button type="button" aria-label="Next photograph" onClick={() => setPhoto((value) => (value + 1) % PHOTOS.length)} className="h-9 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Next</button>
          </div>
        </div>
        <div className="re-actions mt-2 flex gap-2 min-[480px]:hidden">
          <button type="button" aria-label="Previous photograph" onClick={() => setPhoto((value) => (value + PHOTOS.length - 1) % PHOTOS.length)} className="h-11 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Previous</button>
          <button type="button" aria-label="Next photograph" onClick={() => setPhoto((value) => (value + 1) % PHOTOS.length)} className="h-11 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Next</button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PHOTOS.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-current={index === photo ? "true" : undefined}
              onClick={() => setPhoto(index)}
              className={`overflow-hidden rounded-[8px] border-2 ${index === photo ? "border-sales-text-primary" : "border-sales-border"}`}
            >
              <img src={item.src} alt="" className="aspect-[16/10] w-full object-cover" />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Viewing form</h2>
        <p className="mt-1 text-[13px] text-sales-text-secondary">Choose a time, then copy the form for the buyer.</p>
        <label className="mt-3 block text-[13px] font-medium text-sales-text-secondary">
          Proposed time
          <input
            type="datetime-local"
            value={slot}
            onChange={(event) => setSlot(event.target.value)}
            className="mt-1 h-11 w-full min-w-0 max-w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px] text-sales-text-primary"
          />
        </label>
        <button type="button" onClick={() => void copyViewing()} className="re-fill mt-3 inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text">
          Copy viewing form
        </button>
        {notice ? <p className="mt-3 text-[13px] text-sales-text-secondary">{notice}</p> : null}
      </section>

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Seller</h2>
          <span className="text-[13px] text-sales-text-muted">Individual</span>
        </div>
        <div className="re-split flex flex-wrap items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">David Mafigu</p>
            <p className="mt-0.5 text-[13px] text-sales-text-secondary">+263 77 412 8806</p>
          </div>
          <div className="re-actions re-stack flex flex-wrap gap-2">
            <IconButton label="Call" icon />
            <IconButton label="WhatsApp" />
            <IconButton label="Open seller" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="re-split flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Offers</h2>
          <button type="button" className="h-11 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover min-[480px]:h-9">
            Send offer form
          </button>
        </div>
        <div className="re-split flex items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">Tawonga Creig</p>
            <p className="mt-0.5 text-[13px] text-sales-text-secondary">The offer form has not been sent. The buyer writes the amount.</p>
          </div>
          <button type="button" className="h-11 shrink-0 rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface min-[480px]:h-9">
            Send form
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Property</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-sales-text-secondary">A house on a quiet avenue in Avondale, with a practical layout and a garden at the back.</p>
        </div>
        <dl className="grid gap-x-6 gap-y-3 border-t border-sales-border-subtle px-4 py-3 sm:grid-cols-2">
          {[
            ["Address", "2 Baines Avenue, Avondale, Harare"],
            ["Type", "House"],
            ["Bedrooms", "4"],
            ["Bathrooms", "2"],
            ["Size", "220 m²"],
            ["Ownership", "Full Title"],
            ["Occupied by", "Owner occupied"],
            ["Asking price", "US$185,000"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[12px] text-sales-text-muted">{label}</dt>
              <dd className="text-[14px] font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Buyers</h2>
          <span className="text-[13px] text-sales-text-muted">1</span>
        </div>
        <div className="re-split flex flex-wrap items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">Tendai Moyo</p>
            <p className="mt-0.5 text-[13px] text-sales-text-secondary">Budget up to US$190,000 · Borrowdale, Avondale</p>
          </div>
          <button type="button" className="h-9 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
            Send
          </button>
        </div>
      </section>

      <section className="re-split flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Public page</h2>
          <p className="mt-0.5 text-[13px] text-sales-text-secondary">Your link for this property. The agency keeps the listing.</p>
        </div>
        <button type="button" className="h-9 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
          Copy link
        </button>
      </section>
    </div>
  );
}

function IconButton({ label, icon = false }: { label: string; icon?: boolean }) {
  return (
    <button type="button" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
      {icon ? <Phone size={16} strokeWidth={1.75} aria-hidden /> : null}
      {label}
    </button>
  );
}
