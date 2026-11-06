"use client";

import { useEffect, useState } from "react";

type Preview = {
  purpose?: string;
  brand?: { agencyName?: string; logoUrl?: string | null; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null };
  propertyLabel?: string;
  slots?: string[];
  synthetic?: boolean;
  error?: string;
};

export default function JourneyFormPage({ params }: { params: { token: string } }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [signature, setSignature] = useState("");
  const [slot, setSlot] = useState("");
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

  const brand = preview?.brand;
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
      {brand?.logoUrl ? <img src={brand.logoUrl} alt="" className="h-12 w-auto" /> : null}
      <h1 className="text-[22px] font-semibold text-sales-text-primary">{brand?.agencyName ?? "Agency form"}</h1>
      <p className="text-[13px] text-sales-text-secondary">{[brand?.contactName, brand?.contactPhone, brand?.contactEmail].filter(Boolean).join(" · ")}</p>
      <p className="text-[15px] text-sales-text-primary">{preview?.propertyLabel}</p>
      {preview?.synthetic ? <p className="text-[13px] text-sales-text-secondary">This is a practice form until the agency approves its template.</p> : null}
      {preview?.error ? <p className="text-[13px] text-sales-danger-fg">{preview.error}</p> : null}
      <label className="block text-[13px]">Your name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
      {preview?.purpose === "viewing_acknowledgement" ? (
        <>
          <label className="block text-[13px]">Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <label className="block text-[13px]">Time
            <select value={slot} onChange={(event) => setSlot(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3">
              <option value="">Choose a time or type another below</option>
              {(preview.slots ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-[13px]">Another time<input type="datetime-local" onChange={(event) => setSlot(event.target.value ? new Date(event.target.value).toISOString() : slot)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <p className="text-[13px] text-sales-text-secondary">Signing confirms you understand a requested time is not a booking until the agency confirms it.</p>
          <label className="block text-[13px]">Signature<input value={signature} onChange={(event) => setSignature(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <button type="button" className="min-h-11 rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text" onClick={() => void submit({ action: "viewing", slot, name, phone, signature })}>Submit viewing form</button>
        </>
      ) : null}
      {preview?.purpose === "offer_buyer" ? (
        <>
          <p className="text-[13px] text-sales-text-secondary">The offer stays open for seven days from your signature unless the agency template sets another period. You will see the exact expiry after you sign.</p>
          <label className="block text-[13px]">Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <label className="block text-[13px]">Conditions<textarea value={conditions} onChange={(event) => setConditions(event.target.value)} className="mt-1 min-h-24 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <label className="block text-[13px]">Signature<input value={signature} onChange={(event) => setSignature(event.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-sales-border px-3" /></label>
          <button type="button" className="min-h-11 rounded-[10px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text" onClick={() => void submit({ action: "sign_offer", name, signature, amount: Number(amount), conditions })}>Sign offer</button>
        </>
      ) : null}
      {preview?.purpose === "offer_seller" ? (
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
