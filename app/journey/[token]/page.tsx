"use client";

import { useEffect, useState } from "react";
import { PublicJourneyShell, ViewingAcknowledgementForm, type ViewingFormPreview } from "@/components/real-estate/workflow/ViewingAcknowledgementForm";

export default function JourneyFormPage({ params }: { params: { token: string } }) {
  const [preview, setPreview] = useState<ViewingFormPreview | null>(null);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");
  const [amount, setAmount] = useState("");
  const [conditions, setConditions] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/public/journey/${params.token}`).then(async (response) => {
      setPreview(await response.json());
    });
  }, [params.token]);

  async function submit(body: Record<string, unknown>) {
    const response = await fetch(`/api/public/journey/${params.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({})) as { copy?: string; error?: string; transactionStart?: { state?: string; error?: string }; sellerPath?: string };
    if (!response.ok) {
      setResult(json.error ?? "The form was not saved.");
      return;
    }
    const recovery = json.transactionStart?.state === "recovery" ? ` ${json.transactionStart.error} Retry from the agency.` : "";
    setResult(`${json.copy ?? "Saved."}${json.sellerPath ? ` Seller link: ${json.sellerPath}` : ""}${recovery}`);
  }

  if (!preview) {
    return (
      <PublicJourneyShell>
        <p className="text-[15px] text-sales-text-secondary">Loading the form.</p>
      </PublicJourneyShell>
    );
  }

  if (preview.purpose === "viewing_acknowledgement") {
    return <ViewingAcknowledgementForm token={params.token} preview={preview} />;
  }

  if (preview.error || !preview.purpose) {
    return (
      <PublicJourneyShell>
        <section className="max-w-lg rounded-[12px] border border-sales-border bg-sales-surface px-5 py-5">
          <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">This form is not available</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-sales-text-secondary">{preview.error ?? "This link is not available."}</p>
        </section>
      </PublicJourneyShell>
    );
  }

  const brand = preview.brand;
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold text-sales-text-primary">{brand?.agencyName ?? "Agency form"}</h1>
      <p className="text-[13px] text-sales-text-secondary">{[brand?.contactName, brand?.contactPhone, brand?.contactEmail].filter(Boolean).join(" · ")}</p>
      {preview.propertyLabel ? <p className="text-[15px] text-sales-text-primary">{preview.propertyLabel}</p> : null}
      {preview.synthetic ? <p className="text-[13px] text-sales-text-secondary">This is a practice form until the agency approves its template.</p> : null}
      <label className="block text-[13px]">Your name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
      {preview.purpose === "offer_buyer" ? (
        <>
          <p className="text-[13px] text-sales-text-secondary">The offer stays open for seven days from your signature unless the agency template sets another period. You will see the exact expiry after you sign.</p>
          <label className="block text-[13px]">Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <label className="block text-[13px]">Conditions<textarea value={conditions} onChange={(event) => setConditions(event.target.value)} className="mt-1 min-h-24 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <label className="block text-[13px]">Signature<input value={signature} onChange={(event) => setSignature(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <button type="button" className="min-h-11 rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text" onClick={() => void submit({ action: "sign_offer", name, signature, amount: Number(amount), conditions })}>Sign offer</button>
        </>
      ) : null}
      {preview.purpose === "offer_seller" ? (
        <>
          <p className="text-[13px] text-sales-text-secondary">This is the buyer-signed revision. Accepting signs that revision. A change to the terms needs the buyer to sign again.</p>
          <label className="block text-[13px]">Signature<input value={signature} onChange={(event) => setSignature(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text" onClick={() => void submit({ action: "seller_decision", decision: "accept", name, signature })}>Accept and sign</button>
            <button type="button" className="min-h-11 rounded-[10px] border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void submit({ action: "seller_decision", decision: "decline", name, signature: "declined" })}>Decline</button>
          </div>
        </>
      ) : null}
      {result ? <p className="text-[14px] text-sales-text-primary">{result}</p> : null}
    </main>
  );
}
