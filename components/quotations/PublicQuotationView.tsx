"use client";

import { useMemo, useState } from "react";
import { computeCustomerSelectedTotals } from "@/lib/quotations/selected-totals";
import { formatMoney } from "@/lib/quotations/totals";
import { ResidentialPremiumSolarDigital } from "@/components/quotations/layouts/ResidentialPremiumSolarDigital";
import { isSolarLayout } from "@/lib/quotations/layouts/registry";
import type { QuoteDocumentModel } from "@/lib/quotations/layouts/types";

export type PublicQuoteItem = {
  id?: string;
  item_name: string;
  description: string | null;
  unit_price: number;
  quantity: number;
  amount: number;
  group_label: string | null;
  is_optional?: boolean;
  offer_option_id?: string | null;
};

export type PublicQuotationData = {
  token: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "superseded";
  quoteNumber: string | null;
  revisionNumber?: number;
  customerName: string | null;
  currency: string;
  validUntil: string | null;
  issuedAt?: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  otherAmount: number;
  discountPercent?: number;
  total: number;
  notes: string | null;
  terms: string | null;
  paymentTerms?: string | null;
  warrantyTerms?: string | null;
  deliveryTerms?: string | null;
  pdfUrl: string | null;
  superseded?: boolean;
  currentToken?: string | null;
  items: PublicQuoteItem[];
  offerOptions?: { id: string; label: string; description?: string | null }[];
  customerActions?: {
    accept: boolean;
    requestChanges: boolean;
    askQuestion: boolean;
    decline: boolean;
    optionSelection: boolean;
    requireName: boolean;
    requireCheckbox: boolean;
  };
  brand: {
    companyName: string;
    logoUrl: string | null;
    brandColor: string;
    companyEmail: string | null;
    companyPhone: string | null;
    companyAddress?: string | null;
    footerNote: string | null;
  };
  document?: QuoteDocumentModel | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CHANGE_CATEGORIES = ["Pricing", "Scope", "Product/service", "Payment terms", "Timeline", "Warranty", "Other"];
const DECLINE_REASONS = [
  "Price too high",
  "Scope not suitable",
  "Timeline",
  "Payment terms",
  "Went with another company",
  "Project postponed",
  "Other",
];

export function PublicQuotationView({ data }: { data: PublicQuotationData }) {
  const [status, setStatus] = useState(data.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "accept" | "changes" | "question" | "decline">(null);
  const [selectedOptional, setSelectedOptional] = useState<string[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(data.offerOptions?.[0]?.id ?? null);
  const [acceptName, setAcceptName] = useState("");
  const [acceptConfirm, setAcceptConfirm] = useState(false);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const actions = data.customerActions ?? {
    accept: true,
    requestChanges: true,
    askQuestion: true,
    decline: true,
    optionSelection: true,
    requireName: false,
    requireCheckbox: true,
  };
  const brand = data.brand.brandColor || "#0F7A4F";
  const expired = status === "expired";
  const superseded = status === "superseded" || data.superseded;
  const responded = status === "accepted" || status === "rejected";
  const canRespond = (status === "sent" || status === "viewed") && !expired && !superseded;

  const baseItems = data.items.filter((it) => !it.is_optional);
  const optionalItems = data.items.filter((it) => it.is_optional);
  const selectedTotals = useMemo(
    () =>
      computeCustomerSelectedTotals(
        data.items.map((it) => ({
          item_name: it.item_name,
          unit_price: it.unit_price,
          quantity: it.quantity,
          is_optional: it.is_optional,
        })),
        selectedOptional,
        {
          fallbackTaxRate: data.taxRate,
          otherAmount: data.otherAmount,
          discountPercent: data.discountPercent ?? 0,
        }
      ),
    [data, selectedOptional]
  );

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${data.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          selectedOptionalIds: selectedOptional,
          selectedOfferOptionId: selectedOffer,
          ...extra,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      return json;
    } finally {
      setBusy(null);
    }
  }

  async function accept() {
    const json = await post("accept", {
      name: acceptName,
      confirmed: acceptConfirm || !actions.requireCheckbox,
    });
    if (json) {
      setStatus("accepted");
      setPanel(null);
    }
  }

  async function decline() {
    const json = await post("decline", { category, message });
    if (json) {
      setStatus("rejected");
      setPanel(null);
    }
  }

  async function requestChanges() {
    const json = await post("request_changes", { category, message });
    if (json) {
      setDoneMessage("Your change request has been sent.");
      setPanel(null);
    }
  }

  async function askQuestion() {
    const json = await post("ask_question", { message });
    if (json) {
      setDoneMessage("Your question has been sent to the team.");
      setPanel(null);
      setMessage("");
    }
  }

  function toggleOptional(id: string) {
    if (!actions.optionSelection || !canRespond) return;
    setSelectedOptional((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    void post("select_option", {
      selectedOptionalIds: selectedOptional.includes(id)
        ? selectedOptional.filter((x) => x !== id)
        : [...selectedOptional, id],
    }).catch(() => undefined);
  }

  const solarDoc = data.document && isSolarLayout(data.document.layoutKey) ? data.document : null;

  return (
    <div className="min-h-screen bg-[#f4f4f5] px-3 py-6 sm:px-4 sm:py-10">
      <div className={`mx-auto w-full ${solarDoc ? "max-w-4xl" : "max-w-2xl"}`}>
        <article className="overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-sm">
          {!solarDoc ? (
          <header className="px-5 py-6 sm:px-8 sm:py-7" style={{ background: brand }}>
            <div className="flex items-start justify-between gap-4">
              {data.brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.brand.logoUrl} alt="" className="h-12 w-12 rounded-lg bg-white object-contain p-1" />
              ) : (
                <div className="text-lg font-semibold text-white">{data.brand.companyName}</div>
              )}
              <div className="text-right text-white">
                <p className="text-[11px] uppercase tracking-wider opacity-80">Quotation</p>
                <p className="text-lg font-semibold">{data.quoteNumber ?? "Draft"}</p>
                {data.revisionNumber ? (
                  <p className="text-[12px] opacity-80">Version {data.revisionNumber}</p>
                ) : null}
              </div>
            </div>
            <p className="mt-4 text-sm text-white/90">{data.brand.companyName}</p>
          </header>
          ) : null}

          <div className={solarDoc ? "" : "space-y-5 px-5 py-5 sm:px-8 sm:py-7"}>
            <div className={solarDoc ? "space-y-3 px-4 pt-4 sm:px-7" : "contents"}>
            {superseded ? (
              <StateBanner
                title="A newer version of this quotation is available."
                body="This version can no longer be accepted."
                href={data.currentToken ? `/quote/${data.currentToken}` : undefined}
              />
            ) : null}
            {expired && !responded ? (
              <StateBanner
                title="This quotation has expired."
                body={`Contact ${data.brand.companyName} for an updated offer.`}
              />
            ) : null}
            {status === "accepted" ? (
              <StateBanner title="Quotation accepted" body="Thank you. The team will confirm the next step." tone="ok" />
            ) : null}
            {status === "rejected" ? (
              <StateBanner title="Quotation declined" body="Thank you for letting us know." />
            ) : null}
            {doneMessage ? <StateBanner title={doneMessage} tone="ok" /> : null}
            </div>

            {solarDoc ? (
              <ResidentialPremiumSolarDigital
                model={solarDoc}
                interactiveOptional={canRespond && actions.optionSelection}
                selectedOptional={selectedOptional}
                onToggleOptional={toggleOptional}
                hidePrintAcceptance
              />
            ) : null}

            {!solarDoc ? (
            <>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <Meta label="Prepared for" value={data.customerName || "—"} />
              <Meta label="Date" value={formatDate(data.issuedAt)} />
              <Meta label="Valid until" value={formatDate(data.validUntil)} />
              <Meta label="Version" value={String(data.revisionNumber ?? 1)} />
            </dl>

            {data.notes ? (
              <section>
                <h2 className="text-[15px] font-semibold text-[#09090b]">Project summary</h2>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-6 text-[#3f3f46]">{data.notes}</p>
              </section>
            ) : null}

            <section>
              <h2 className="text-[15px] font-semibold text-[#09090b]">Products & services</h2>
              <ul className="mt-3 space-y-2">
                {baseItems.map((it, idx) => (
                  <LineCard key={it.id ?? `${it.item_name}-${idx}`} item={it} currency={data.currency} />
                ))}
              </ul>
            </section>

            {optionalItems.length > 0 ? (
              <section>
                <h2 className="text-[15px] font-semibold text-[#09090b]">Optional items</h2>
                <p className="mt-1 text-[12.5px] text-[#71717a]">These are not included unless you select them.</p>
                <ul className="mt-3 space-y-2">
                  {optionalItems.map((it) => {
                    const key = it.id ?? it.item_name;
                    const on = selectedOptional.includes(key);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          disabled={!canRespond || !actions.optionSelection}
                          onClick={() => toggleOptional(key)}
                          className={`w-full rounded-xl border px-3 py-3 text-left ${
                            on ? "border-[#18181b] bg-[#fafafa]" : "border-[#e4e4e7] bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[13.5px] font-medium text-[#09090b]">{it.item_name}</p>
                              {it.description ? (
                                <p className="mt-0.5 text-[12.5px] text-[#71717a]">{it.description}</p>
                              ) : null}
                              <p className="mt-1 text-[12px] text-[#71717a]">Optional</p>
                            </div>
                            <p className="shrink-0 text-[13.5px] font-semibold">
                              +{formatMoney(it.amount || it.unit_price * it.quantity, data.currency)}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {data.offerOptions && data.offerOptions.length > 1 ? (
              <section>
                <h2 className="text-[15px] font-semibold text-[#09090b]">Offer options</h2>
                <div className="mt-3 space-y-2">
                  {data.offerOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!canRespond}
                      onClick={() => setSelectedOffer(opt.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left ${
                        selectedOffer === opt.id ? "border-[#18181b]" : "border-[#e4e4e7]"
                      }`}
                    >
                      <p className="text-[13.5px] font-medium">{opt.label}</p>
                      {opt.description ? <p className="mt-1 text-[12.5px] text-[#71717a]">{opt.description}</p> : null}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-xl bg-[#fafafa] px-4 py-4">
              <Row label="Base total" value={formatMoney(data.total, data.currency)} />
              {selectedOptional.length > 0 ? (
                <Row
                  label="Selected options"
                  value={formatMoney(selectedTotals.total - data.total, data.currency)}
                />
              ) : null}
              <Row label="Tax" value={formatMoney(selectedTotals.taxAmount, data.currency)} />
              <div className="mt-2 border-t border-[#e4e4e7] pt-2">
                <Row label="Selected total" value={formatMoney(selectedTotals.total, data.currency)} bold />
              </div>
            </section>

            {data.paymentTerms ? (
              <section>
                <h2 className="text-[15px] font-semibold">Payment terms</h2>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-6 text-[#3f3f46]">{data.paymentTerms}</p>
              </section>
            ) : null}
            {data.warrantyTerms ? (
              <section>
                <h2 className="text-[15px] font-semibold">Warranty</h2>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-6 text-[#3f3f46]">{data.warrantyTerms}</p>
              </section>
            ) : null}
            {data.deliveryTerms ? (
              <section>
                <h2 className="text-[15px] font-semibold">Timeline</h2>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-6 text-[#3f3f46]">{data.deliveryTerms}</p>
              </section>
            ) : null}
            {data.terms ? (
              <section>
                <details className="group">
                  <summary className="cursor-pointer list-none text-[15px] font-semibold">
                    Terms
                    <span className="ml-2 text-[12px] font-normal text-[#71717a] group-open:hidden">Show</span>
                    <span className="ml-2 hidden text-[12px] font-normal text-[#71717a] group-open:inline">Hide</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-6 text-[#3f3f46]">{data.terms}</p>
                </details>
              </section>
            ) : null}
            </>
            ) : null}

            {error ? <p className={`text-[13px] text-red-600 ${solarDoc ? "px-4 sm:px-7" : ""}`}>{error}</p> : null}

            {canRespond ? (
              <div className={`sticky bottom-0 space-y-2 border-t border-[#e4e4e7] bg-white py-4 ${solarDoc ? "px-4 sm:px-7" : "-mx-5 px-5 sm:-mx-8 sm:px-8"}`}>
                {actions.accept ? (
                  <button
                    type="button"
                    className="w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-white"
                    style={{ background: brand }}
                    onClick={() => setPanel("accept")}
                  >
                    Accept quotation
                  </button>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  {actions.requestChanges ? (
                    <GhostBtn onClick={() => setPanel("changes")}>Request changes</GhostBtn>
                  ) : null}
                  {actions.askQuestion ? (
                    <GhostBtn onClick={() => setPanel("question")}>Ask a question</GhostBtn>
                  ) : null}
                  {actions.decline ? (
                    <GhostBtn onClick={() => setPanel("decline")}>Decline</GhostBtn>
                  ) : null}
                  {data.pdfUrl || data.token ? (
                    <a
                      className="rounded-xl border border-[#e4e4e7] px-3 py-2.5 text-center text-[13px] font-medium text-[#18181b]"
                      href={data.pdfUrl || `/api/quotes/${data.token}/pdf`}
                    >
                      Download PDF
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {expired && data.brand.companyPhone ? (
              <a
                className="block rounded-xl px-4 py-3 text-center text-[14px] font-semibold text-white"
                style={{ background: brand }}
                href={`tel:${data.brand.companyPhone}`}
              >
                Contact {data.brand.companyName}
              </a>
            ) : null}
          </div>
        </article>
        <p className="mt-4 text-center text-[11px] text-[#a1a1aa]">Powered by SegmiQ</p>
      </div>

      {panel === "accept" ? (
        <Sheet title="Accept quotation" onClose={() => setPanel(null)}>
          <p className="text-[13.5px] text-[#3f3f46]">
            Quotation {data.quoteNumber} · Version {data.revisionNumber ?? 1}
            <br />
            Amount {formatMoney(selectedTotals.total, data.currency)}
            <br />
            {data.brand.companyName}
          </p>
          <p className="mt-2 text-[12.5px] text-[#71717a]">
            This records your acceptance of the offer. It is not an electronic signature.
          </p>
          {actions.requireName ? (
            <input
              className="mt-3 w-full rounded-lg border border-[#e4e4e7] px-3 py-2 text-[13px]"
              placeholder="Your name"
              value={acceptName}
              onChange={(e) => setAcceptName(e.target.value)}
            />
          ) : null}
          {actions.requireCheckbox ? (
            <label className="mt-3 flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={acceptConfirm} onChange={(e) => setAcceptConfirm(e.target.checked)} />
              I confirm I am accepting this quotation.
            </label>
          ) : null}
          <button
            type="button"
            disabled={busy === "accept"}
            className="mt-4 w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-white"
            style={{ background: brand }}
            onClick={() => void accept().catch((e) => setError(e instanceof Error ? e.message : "Failed"))}
          >
            {busy === "accept" ? "Confirming…" : "Confirm acceptance"}
          </button>
        </Sheet>
      ) : null}

      {panel === "changes" ? (
        <Sheet title="Request changes" onClose={() => setPanel(null)}>
          <select
            className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2 text-[13px]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Category (optional)</option>
            {CHANGE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <textarea
            className="mt-2 w-full rounded-lg border border-[#e4e4e7] px-3 py-2 text-[13px]"
            rows={4}
            placeholder="What would you like changed?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-[#18181b] px-4 py-3 text-[14px] font-semibold text-white"
            onClick={() => void requestChanges().catch((e) => setError(e instanceof Error ? e.message : "Failed"))}
          >
            Send request
          </button>
        </Sheet>
      ) : null}

      {panel === "question" ? (
        <Sheet title="Ask a question" onClose={() => setPanel(null)}>
          <textarea
            className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2 text-[13px]"
            rows={4}
            placeholder="Your question"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-[#18181b] px-4 py-3 text-[14px] font-semibold text-white"
            onClick={() => void askQuestion().catch((e) => setError(e instanceof Error ? e.message : "Failed"))}
          >
            Send question
          </button>
        </Sheet>
      ) : null}

      {panel === "decline" ? (
        <Sheet title="Decline quotation" onClose={() => setPanel(null)}>
          <select
            className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2 text-[13px]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Reason (optional)</option>
            {DECLINE_REASONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <textarea
            className="mt-2 w-full rounded-lg border border-[#e4e4e7] px-3 py-2 text-[13px]"
            rows={3}
            placeholder="Optional note"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-[#18181b] px-4 py-3 text-[14px] font-semibold text-white"
            onClick={() => void decline().catch((e) => setError(e instanceof Error ? e.message : "Failed"))}
          >
            Decline quotation
          </button>
        </Sheet>
      ) : null}
    </div>
  );
}

function LineCard({ item, currency }: { item: PublicQuoteItem; currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-[#e4e4e7] px-3 py-3">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((v) => !v)}>
        <div>
          <p className="text-[13.5px] font-medium text-[#09090b]">{item.item_name}</p>
          <p className="text-[12px] text-[#71717a]">
            {item.quantity} × {formatMoney(item.unit_price, currency)}
          </p>
        </div>
        <p className="text-[13.5px] font-semibold">{formatMoney(item.amount || item.unit_price * item.quantity, currency)}</p>
      </button>
      {open && item.description ? (
        <p className="mt-2 text-[12.5px] leading-5 text-[#52525b]">{item.description}</p>
      ) : null}
    </li>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[#a1a1aa]">{label}</dt>
      <dd className="mt-0.5 font-medium text-[#18181b]">{value}</dd>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-[13.5px] ${bold ? "font-semibold" : ""}`}>
      <span className="text-[#71717a]">{label}</span>
      <span className="text-[#18181b]">{value}</span>
    </div>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[#e4e4e7] px-3 py-2.5 text-[13px] font-medium text-[#18181b]"
    >
      {children}
    </button>
  );
}

function StateBanner({
  title,
  body,
  href,
  tone,
}: {
  title: string;
  body?: string;
  href?: string;
  tone?: "ok";
}) {
  return (
    <div className={`rounded-xl px-4 py-3 ${tone === "ok" ? "bg-[#ecfccb]" : "bg-[#f4f4f5]"}`}>
      <p className="text-[14px] font-semibold text-[#18181b]">{title}</p>
      {body ? <p className="mt-1 text-[13px] text-[#52525b]">{body}</p> : null}
      {href ? (
        <a className="mt-2 inline-block text-[13px] font-semibold underline" href={href}>
          Open current quotation
        </a>
      ) : null}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-[13px] text-[#71717a]">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
