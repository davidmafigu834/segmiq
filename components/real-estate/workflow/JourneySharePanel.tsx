"use client";

import { useState } from "react";

export function JourneySharePanel({ clientId, listingId }: { clientId: string; listingId: string }) {
  const [slot, setSlot] = useState("");
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function shareViewing() {
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/clients/${clientId}/workflow/viewing-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, slots: slot ? [new Date(slot).toISOString()] : [], templateKey: "synthetic-viewing-acknowledgement" }),
    });
    const json = await response.json().catch(() => ({})) as { path?: string; error?: string };
    setBusy(false);
    if (!response.ok || !json.path) {
      setNotice(json.error ?? "The viewing form was not created.");
      return;
    }
    const url = `${window.location.origin}${json.path}`;
    setLink(url);
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setNotice("Viewing form link copied.");
  }

  async function createOffer() {
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/clients/${clientId}/workflow/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId,
        contactId,
        amount: Number(amount),
        templateKey: "synthetic-offer-to-purchase",
      }),
    });
    const json = await response.json().catch(() => ({})) as { path?: string; error?: string };
    setBusy(false);
    if (!response.ok || !json.path) {
      setNotice(json.error ?? "The offer link was not created.");
      return;
    }
    const url = `${window.location.origin}${json.path}`;
    setLink(url);
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setNotice("Buyer offer link copied.");
  }

  return (
    <section className="space-y-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3" aria-label="Share property forms">
      <h3 className="text-[15px] font-semibold text-sales-text-primary">Share with a buyer</h3>
      <label className="block text-[13px] text-sales-text-secondary">
        Proposed viewing time
        <input type="datetime-local" value={slot} onChange={(event) => setSlot(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" />
      </label>
      <button type="button" disabled={busy} onClick={() => void shareViewing()} className="inline-flex min-h-11 items-center rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text">
        Share viewing form
      </button>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[13px] text-sales-text-secondary">
          Buyer contact
          <input value={contactId} onChange={(event) => setContactId(event.target.value)} placeholder="Contact id" className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" />
        </label>
        <label className="block text-[13px] text-sales-text-secondary">
          Offer amount
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" />
        </label>
      </div>
      <button type="button" disabled={busy || !contactId || !amount} onClick={() => void createOffer()} className="inline-flex min-h-11 items-center rounded-[10px] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary">
        Create offer link
      </button>
      {notice ? <p className="text-[13px] text-sales-text-secondary">{notice}</p> : null}
      {link ? <p className="break-all text-[13px] text-sales-text-primary">{link}</p> : null}
    </section>
  );
}
