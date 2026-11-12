"use client";

import { useState } from "react";

export function JourneySharePanel({
  clientId,
  listingId,
  onCreateOffer,
}: {
  clientId: string;
  listingId: string;
  onCreateOffer?: () => void;
}) {
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
    setNotice("Viewing form copied. Send it to the buyer.");
  }

  return (
    <section className="space-y-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3" aria-label="Share property forms">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-sales-text-primary">Viewing form</h3>
          <p className="mt-1 text-[13px] text-sales-text-secondary">Choose a time, then copy the form for the buyer.</p>
        </div>
        {onCreateOffer ? (
          <button type="button" onClick={onCreateOffer} className="inline-flex min-h-11 items-center rounded-[10px] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary">
            Create offer
          </button>
        ) : null}
      </div>
      <label className="block text-[13px] text-sales-text-secondary">
        Proposed time
        <input type="datetime-local" value={slot} onChange={(event) => setSlot(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-sales-text-primary" />
      </label>
      <button type="button" disabled={busy} onClick={() => void shareViewing()} className="inline-flex min-h-11 items-center rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text disabled:opacity-50">
        {busy ? "Creating…" : "Copy viewing form"}
      </button>
      {notice ? <p className="text-[13px] text-sales-text-secondary">{notice}</p> : null}
      {link ? <p className="break-all text-[13px] text-sales-text-primary">{link}</p> : null}
    </section>
  );
}
