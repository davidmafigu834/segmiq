"use client";

import { useState } from "react";

export function JourneySharePanel({ clientId, listingId }: { clientId: string; listingId: string }) {
  const [slot, setSlot] = useState("");
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

  return (
    <section className="space-y-3" aria-label="Share a viewing form">
      <p className="text-[13px] text-sales-text-secondary">Send this house to an interested buyer. Signing the form opens their profile and puts this time on the calendar.</p>
      <label className="block text-[13px] text-sales-text-secondary">
        Proposed viewing time
        <input type="datetime-local" value={slot} onChange={(event) => setSlot(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border bg-transparent px-3" />
      </label>
      <button type="button" disabled={busy || !slot} onClick={() => void shareViewing()} className="inline-flex min-h-11 items-center rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text">
        {busy ? "Preparing…" : "Share viewing form"}
      </button>
      {notice ? <p className="text-[13px] text-sales-text-secondary">{notice}</p> : null}
      {link ? <p className="break-all text-[13px] text-sales-text-primary">{link}</p> : null}
    </section>
  );
}
