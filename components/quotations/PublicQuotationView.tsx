"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/quotations/totals";

export type PublicQuotationData = {
  token: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
  quoteNumber: string | null;
  customerName: string | null;
  currency: string;
  validUntil: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  otherAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  pdfUrl: string | null;
  items: {
    item_name: string;
    description: string | null;
    unit_price: number;
    quantity: number;
    amount: number;
    group_label: string | null;
  }[];
  brand: {
    companyName: string;
    logoUrl: string | null;
    brandColor: string;
    companyEmail: string | null;
    companyPhone: string | null;
    footerNote: string | null;
  };
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PublicQuotationView({ data }: { data: PublicQuotationData }) {
  const [status, setStatus] = useState(data.status);
  const [busy, setBusy] = useState<null | "accept" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const brand = data.brand.brandColor || "#0F7A4F";
  const responded = status === "accepted" || status === "rejected";
  const expired = status === "expired";
  const canRespond = (status === "sent" || status === "viewed") && !expired;

  async function respond(action: "accept" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${data.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setStatus(action === "accept" ? "accepted" : "rejected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white">
          <div className="px-8 py-7" style={{ background: brand }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {data.brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.brand.logoUrl} alt="" className="h-11 w-11 rounded object-contain bg-white/90 p-1" />
                ) : null}
                <span className="text-xl font-bold text-white">{data.brand.companyName}</span>
              </div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Quotation
              </span>
            </div>
          </div>

          <div className="px-8 py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">
              {data.quoteNumber ? `Quotation ${data.quoteNumber}` : "Quotation"}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-[#09090b]">
              {data.customerName ? `Quote for ${data.customerName}` : "Your quotation"}
            </h1>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">Valid until</p>
                <p className="mt-0.5 font-semibold text-[#3f3f46]">{formatDate(data.validUntil)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">Total</p>
                <p className="mt-0.5 font-semibold" style={{ color: brand }}>
                  {formatMoney(data.total, data.currency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {data.items.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white">
            <div className="border-b border-[#e4e4e7] px-6 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#71717a]">Line items</h2>
            </div>
            <ul className="divide-y divide-[#e4e4e7]">
              {data.items.map((it, idx) => (
                <li key={idx} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#09090b]">{it.item_name}</p>
                      {it.description ? (
                        <p className="mt-1 text-sm text-[#52525b]">{it.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-[#a1a1aa]">
                        {it.quantity} × {formatMoney(it.unit_price, data.currency)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-[#09090b]">
                      {formatMoney(it.amount, data.currency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#e4e4e7] px-6 py-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#52525b]">Subtotal</span>
                <span>{formatMoney(data.subtotal, data.currency)}</span>
              </div>
              {data.taxRate > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[#52525b]">Tax ({data.taxRate}%)</span>
                  <span>{formatMoney(data.taxAmount, data.currency)}</span>
                </div>
              ) : null}
              {data.otherAmount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[#52525b]">Other</span>
                  <span>{formatMoney(data.otherAmount, data.currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[#e4e4e7] pt-2 text-base font-bold">
                <span>Total</span>
                <span style={{ color: brand }}>{formatMoney(data.total, data.currency)}</span>
              </div>
            </div>
          </div>
        ) : null}

        {data.notes ? (
          <div className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#71717a]">Note</p>
            <p className="mt-2 text-sm text-[#3f3f46]">{data.notes}</p>
          </div>
        ) : null}

        {data.terms ? (
          <div className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#71717a]">Terms</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#3f3f46]">{data.terms}</p>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white px-6 py-6">
          {responded || expired ? (
            <p className="text-center text-sm text-[#52525b]">
              {status === "accepted" && "Thank you — this quotation has been accepted."}
              {status === "rejected" && "This quotation was declined."}
              {expired && "This quotation has expired. Please contact us for an updated version."}
            </p>
          ) : canRespond ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void respond("accept")}
                className="rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: brand }}
              >
                {busy === "accept" ? "Accepting…" : "Accept quotation"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void respond("reject")}
                className="rounded-xl border border-[#e4e4e7] px-6 py-3 text-sm font-semibold text-[#52525b] disabled:opacity-50"
              >
                {busy === "reject" ? "Declining…" : "Decline"}
              </button>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-center text-sm text-red-600">{error}</p> : null}
          {data.pdfUrl ? (
            <p className="mt-4 text-center">
              <a
                href={data.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold underline"
                style={{ color: brand }}
              >
                Download PDF
              </a>
            </p>
          ) : null}
        </div>

        {(data.brand.companyEmail || data.brand.companyPhone || data.brand.footerNote) && (
          <p className="mt-6 text-center text-xs text-[#a1a1aa]">
            {[data.brand.companyEmail, data.brand.companyPhone, data.brand.footerNote]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
