"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/quotations/totals";

export type PublicProposalData = {
  token: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
  title: string;
  proposalNumber: string | null;
  companyName: string | null;
  recipientName: string | null;
  currency: string;
  validUntil: string | null;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  terms: string | null;
  pdfUrl: string | null;
  sections: { kind: string; heading: string | null; body: string | null }[];
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

export function PublicProposalView({ data }: { data: PublicProposalData }) {
  const [status, setStatus] = useState(data.status);
  const [busy, setBusy] = useState<null | "accept" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const brand = data.brand.brandColor || "#0F7A4F";
  const hasItems = data.items.length > 0;
  const responded = status === "accepted" || status === "rejected";
  const expired = status === "expired";
  const canRespond = (status === "sent" || status === "viewed") && !expired;

  async function respond(action: "accept" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${data.token}`, {
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
        {/* Header card */}
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
                Proposal
              </span>
            </div>
          </div>

          <div className="px-8 py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">
              {data.proposalNumber ? `Proposal ${data.proposalNumber}` : "Proposal"}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-[#09090b]">{data.title}</h1>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">Prepared for</p>
                <p className="mt-0.5 font-semibold text-[#3f3f46]">
                  {data.companyName || data.recipientName || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">Valid until</p>
                <p className="mt-0.5 font-semibold text-[#3f3f46]">{formatDate(data.validUntil)}</p>
              </div>
              {hasItems ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">Total</p>
                  <p className="mt-0.5 font-semibold" style={{ color: brand }}>
                    {formatMoney(data.total, data.currency)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Status banner */}
        {responded || expired ? (
          <div
            className="mt-4 rounded-2xl border px-6 py-4 text-sm font-medium"
            style={{
              borderColor: status === "accepted" ? "#16a34a" : "#d4d4d8",
              background: status === "accepted" ? "rgba(22,163,74,0.08)" : "rgba(0,0,0,0.03)",
              color: status === "accepted" ? "#15803d" : "#52525b",
            }}
          >
            {status === "accepted" && "Thank you — you've accepted this proposal. We'll be in touch shortly to get you set up."}
            {status === "rejected" && "You've declined this proposal. If this was a mistake, please get in touch."}
            {expired && "This proposal has expired. Please contact us for an updated version."}
          </div>
        ) : null}

        {/* Narrative sections */}
        {data.sections.length > 0 ? (
          <div className="mt-4 space-y-4">
            {data.sections.map((s, i) => (
              <div key={i} className="rounded-2xl border border-[#e4e4e7] bg-white px-8 py-6">
                {s.heading ? (
                  <h2 className="text-lg font-bold text-[#09090b]">{s.heading}</h2>
                ) : null}
                {s.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#3f3f46]">
                    {s.body}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Pricing */}
        {hasItems ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white">
            <div className="px-8 py-5">
              <h2 className="text-lg font-bold text-[#09090b]">Investment</h2>
            </div>
            <div className="divide-y divide-[#f4f4f5] border-t border-[#f4f4f5]">
              {data.items.map((it, i) => (
                <div key={i} className="flex items-start justify-between gap-4 px-8 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#18181b]">{it.item_name}</p>
                    {it.description ? (
                      <p className="mt-0.5 text-sm text-[#71717a]">{it.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-[#a1a1aa]">
                      {formatMoney(it.unit_price, data.currency)} × {it.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-[#18181b]">
                    {formatMoney(it.amount, data.currency)}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-[#f4f4f5] px-8 py-5">
              <div className="flex justify-between text-sm text-[#52525b]">
                <span>Subtotal</span>
                <span>{formatMoney(data.subtotal, data.currency)}</span>
              </div>
              {data.discount ? (
                <div className="flex justify-between text-sm text-[#52525b]">
                  <span>Discount</span>
                  <span>-{formatMoney(data.discount, data.currency)}</span>
                </div>
              ) : null}
              {data.taxRate > 0 ? (
                <div className="flex justify-between text-sm text-[#52525b]">
                  <span>Tax ({data.taxRate}%)</span>
                  <span>{formatMoney(data.taxAmount, data.currency)}</span>
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between border-t border-[#e4e4e7] pt-3">
                <span className="text-base font-bold text-[#09090b]">Total</span>
                <span className="text-xl font-bold" style={{ color: brand }}>
                  {formatMoney(data.total, data.currency)}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Terms */}
        {data.terms?.trim() ? (
          <div className="mt-4 rounded-2xl border border-[#e4e4e7] bg-white px-8 py-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#71717a]">
              Terms &amp; conditions
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#52525b]">
              {data.terms}
            </p>
          </div>
        ) : null}

        {/* Actions */}
        {canRespond ? (
          <div className="sticky bottom-4 mt-6">
            <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-lg">
              {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void respond("accept")}
                  disabled={busy !== null}
                  className="flex-1 rounded-xl px-5 py-3 text-sm font-bold text-white transition disabled:opacity-50"
                  style={{ background: brand }}
                >
                  {busy === "accept" ? "Submitting…" : "Accept proposal"}
                </button>
                <button
                  type="button"
                  onClick={() => void respond("reject")}
                  disabled={busy !== null}
                  className="rounded-xl border border-[#e4e4e7] px-5 py-3 text-sm font-semibold text-[#52525b] transition hover:bg-[#fafafa] disabled:opacity-50"
                >
                  {busy === "reject" ? "Submitting…" : "Decline"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-1 pb-4 text-center text-xs text-[#a1a1aa]">
          {data.pdfUrl ? (
            <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#52525b] underline">
              Download PDF
            </a>
          ) : null}
          <p>{data.brand.footerNote || data.brand.companyName}</p>
          {(data.brand.companyEmail || data.brand.companyPhone) && (
            <p>{[data.brand.companyEmail, data.brand.companyPhone].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
