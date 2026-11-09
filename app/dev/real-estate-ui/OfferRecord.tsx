"use client";

import { useState } from "react";

type OfferId = "kingsmead" | "stonechat" | "kensington";

const OFFERS: Record<OfferId, {
  property: string;
  place: string;
  buyer: string;
  phone: string;
  amount: string;
  conditions: string;
  status: string;
  line: string;
  signed: string;
  next: "send" | "revise";
}> = {
  stonechat: {
    property: "8 Stonechat Lane",
    place: "Mount Pleasant, Harare",
    buyer: "Chipo Ndlovu",
    phone: "+263 77 418 2201",
    amount: "US$240,000",
    conditions: "Subject to the buyer arranging finance within 14 days.",
    status: "Buyer signed the form",
    line: "Chipo completed the offer form. It is now a PDF. Download it for the seller, or send the seller a link.",
    signed: "7 Nov 2026 · 11:20",
    next: "send",
  },
  kensington: {
    property: "Flat 4B, Kensington",
    place: "Belvedere, Harare",
    buyer: "Farai Dube",
    phone: "+263 77 555 0190",
    amount: "US$98,000",
    conditions: "None added.",
    status: "Buyer signed the form",
    line: "Farai completed the offer form. It is now a PDF. Download it for the seller, or send the seller a link.",
    signed: "6 Nov 2026 · 14:05",
    next: "send",
  },
  kingsmead: {
    property: "14 Kingsmead",
    place: "Borrowdale, Harare",
    buyer: "Tendai Moyo",
    phone: "+263 77 200 1144",
    amount: "US$180,000",
    conditions: "Subject to a satisfactory inspection.",
    status: "Seller sent a counter",
    line: "The seller opened the offer and countered at US$175,000. Send Tendai a revised form. The buyer signs again before a new PDF is made.",
    signed: "8 Nov 2026 · 16:10",
    next: "revise",
  },
};

export function OfferRecord({ id, onClose }: { id: OfferId; onClose: () => void }) {
  const offer = OFFERS[id];
  const [notice, setNotice] = useState<string | null>(null);

  function downloadPdf() {
    const bytes = new Blob(
      [`Offer to purchase\n${offer.property}\nBuyer: ${offer.buyer}\nAmount: ${offer.amount}\nConditions: ${offer.conditions}\nSigned: ${offer.signed}\n`],
      { type: "application/pdf" }
    );
    const url = URL.createObjectURL(bytes);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${offer.property} offer.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("PDF downloaded. Send the file to the seller.");
  }

  async function copySellerLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/journey/seller-${id}`);
    } catch {
      /* The notice still confirms the link is ready. */
    }
    setNotice("Seller link copied. Send it to the seller. They can read the offer there.");
  }

  async function copyBuyerForm() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/journey/buyer-${id}`);
    } catch {
      /* The notice still confirms the link is ready. */
    }
    setNotice("Revised form copied. Send it to the buyer to sign.");
  }

  return (
    <div className="re-in space-y-5">
      <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
        Back
      </button>
      <header>
        <p className="text-[13px] font-medium text-sales-text-muted">{offer.buyer}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{offer.property}</h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">{offer.place}</p>
      </header>

      <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
        <p className="text-[13px] font-semibold">{offer.status}</p>
        <p className="mt-2 text-[14px] text-sales-text-secondary">{offer.line}</p>
        <p className="mt-4 text-[13px] text-sales-text-muted">Amount the buyer wrote</p>
        <p className="mt-1 font-display text-[32px] font-semibold leading-none tabular-nums tracking-[-0.03em]">{offer.amount}</p>
        <p className="mt-3 text-[13px] text-sales-text-muted">Conditions</p>
        <p className="mt-1 text-[14px]">{offer.conditions}</p>
        <p className="mt-3 text-[13px] text-sales-text-secondary">Signed {offer.signed}</p>
        <div className="re-actions mt-4 flex flex-wrap gap-2">
          {offer.next === "send" ? (
            <button type="button" onClick={downloadPdf} className="inline-flex h-11 items-center rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface">
              Download PDF
            </button>
          ) : (
            <button type="button" onClick={() => void copyBuyerForm()} className="inline-flex h-11 items-center rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface">
              Send revised form
            </button>
          )}
          <button type="button" onClick={() => void copySellerLink()} className="inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
            Copy seller link
          </button>
        </div>
        {notice ? <p className="mt-3 text-[13px] text-sales-text-secondary">{notice}</p> : null}
      </section>

      <section className="re-split flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Buyer</h2>
          <p className="mt-0.5 text-[14px] font-medium">{offer.buyer}</p>
          <p className="text-[13px] text-sales-text-secondary">{offer.phone}</p>
          <p className="mt-1 text-[13px] text-sales-text-muted">The buyer fills the form. The amount is not typed here.</p>
        </div>
        <div className="re-actions flex gap-2">
          <Quiet label="Call" />
          <Quiet label="WhatsApp" />
        </div>
      </section>
    </div>
  );
}

function Quiet({ label }: { label: string }) {
  return (
    <button type="button" className="inline-flex h-9 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
      {label}
    </button>
  );
}

export type { OfferId };
