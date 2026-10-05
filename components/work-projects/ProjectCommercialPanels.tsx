"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadCompanyDocument } from "@/lib/documents/client-upload";
import { PAYMENT_METHODS } from "@/lib/work-projects/commercial-rules";
import type { ProjectCommercialSnapshot } from "@/lib/work-projects/commercial-service";

function money(value: number | null, currency: string) {
  if (value == null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function ProjectCommercialSummary({ commercial }: { commercial: ProjectCommercialSnapshot }) {
  if (!commercial.quoteDiffers) return null;
  return <p className="text-[15px]">Project equipment differs from the accepted quotation. The quotation was not changed.</p>;
}

function paymentWord(status: string) {
  const words: Record<string, string> = {
    NOT_REQUIRED: "Not required",
    AWAITING_PAYMENT: "Awaiting payment",
    PARTIALLY_PAID: "Partially paid",
    PAID: "Paid",
    OVERPAID: "Overpaid",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partially refunded",
    PENDING: "Pending confirmation",
    CONFIRMED: "Confirmed",
    REVERSED: "Reversed",
  };
  return words[status] || status.replaceAll("_", " ");
}

export function ProjectPaymentsPanel({
  projectId,
  clientId,
  commercial,
  documentsEnabled,
  customerName,
}: {
  projectId: string;
  clientId: string;
  commercial: ProjectCommercialSnapshot;
  documentsEnabled: boolean;
  customerName?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [termId, setTermId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not update payments.");
      return;
    }
    setError("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <dl className="grid gap-6 sm:grid-cols-3">
        <div><dt className="text-[13px] text-sales-text-secondary">Project value</dt><dd className="mt-1 text-[1.75rem] font-semibold tabular-nums">{money(commercial.projectValue, commercial.currency)}</dd></div>
        <div><dt className="text-[13px] text-sales-text-secondary">Received</dt><dd className="mt-1 text-[1.75rem] font-semibold tabular-nums">{money(commercial.received, commercial.currency)}</dd></div>
        <div><dt className="text-[13px] text-sales-text-secondary">Outstanding</dt><dd className="mt-1 text-[1.75rem] font-semibold tabular-nums">{money(commercial.outstanding, commercial.currency)}</dd></div>
      </dl>
      <p className="text-[15px] text-sales-text-secondary">{paymentWord(commercial.paymentStatus)}</p>
      {commercial.canManage ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void post(`/api/work-projects/${projectId}/payment-terms`, { action: "import" })}>Import payment schedule</button>
          <button type="button" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void post(`/api/work-projects/${projectId}/payment-terms`, { action: "requirement", required: !commercial.paymentRequired })}>{commercial.paymentRequired ? "Mark payment not required" : "Require payment"}</button>
        </div>
      ) : null}
      <section>
        <h3 className="text-[15px] font-semibold">Milestones</h3>
        {commercial.terms.length === 0 ? <p className="mt-2 text-[15px] text-sales-text-secondary">No payment schedule yet.</p> : null}
        <ul className="mt-3 divide-y divide-sales-border-subtle">
          {commercial.terms.map((term) => (
            <li key={term.id} className="flex items-baseline justify-between gap-4 py-3">
              <div>
                <p className="text-[16px] font-semibold">{term.label}</p>
                <p className="mt-1 text-[14px] text-sales-text-secondary">{term.satisfied ? "Paid" : term.overdue ? "Overdue" : "Pending"}</p>
              </div>
              <p className="text-[16px] font-semibold tabular-nums">{money(term.resolvedAmount, commercial.currency)}</p>
            </li>
          ))}
        </ul>
      </section>
      <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        void post(`/api/work-projects/${projectId}/payments`, {
          amount: Number(amount),
          paidAt: new Date(paidAt).toISOString(),
          method,
          reference: reference || null,
          termId: termId || null,
          notes: notes || null,
        });
      }}>
        <h3 className="sm:col-span-2 text-[1.15rem] font-semibold">Record payment</h3>
        <label className="text-[13px] text-sales-text-secondary">Amount
          <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[15px] text-sales-text-primary" />
        </label>
        <label className="text-[13px] text-sales-text-secondary">Date
          <input required type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[15px] text-sales-text-primary" />
        </label>
        <label className="text-[13px] text-sales-text-secondary">Method
          <select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[15px] text-sales-text-primary">
            {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-[13px] text-sales-text-secondary">Milestone
          <select value={termId} onChange={(event) => setTermId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[15px] text-sales-text-primary">
            <option value="">Not applied to a milestone</option>
            {commercial.terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
          </select>
        </label>
        <label className="text-[13px] text-sales-text-secondary">Reference
          <input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[15px] text-sales-text-primary" />
        </label>
        <label className="text-[13px] text-sales-text-secondary">Notes
          <input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[15px] text-sales-text-primary" />
        </label>
        <button type="submit" className="min-h-11 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary sm:col-span-2 sm:w-fit">Record payment</button>
        <p className="text-[13px] text-sales-text-secondary sm:col-span-2">Recorded payments stay pending until a manager confirms them.</p>
      </form>
      <section>
        <h3 className="text-[15px] font-semibold">History</h3>
        <ul className="mt-2 space-y-2">
          {commercial.payments.map((payment) => (
            <li key={payment.id} className="border-b border-sales-border-subtle py-4 text-[14px]">
              <p className="text-[16px] font-semibold">{money(Number(payment.amount), payment.currency)}</p>
              <p className="mt-1 text-sales-text-secondary">{paymentWord(payment.status)} · {payment.payment_method.replaceAll("_", " ")}</p>
              <p className="text-sales-text-secondary">{new Date(payment.paid_at).toLocaleString()} {payment.reference ? `· ${payment.reference}` : ""} {payment.proofCount ? "· Proof attached" : ""}</p>
              {commercial.canManage && payment.status === "PENDING" && confirming !== payment.id ? (
                <button type="button" className="mt-3 min-h-11 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary" onClick={() => setConfirming(payment.id)}>Review payment</button>
              ) : null}
              {confirming === payment.id ? (
                <div className="mt-3 max-w-md">
                  <p className="text-[16px] font-semibold">Confirm {money(Number(payment.amount), payment.currency)}?</p>
                  <p className="mt-1 text-sales-text-secondary">This will count the payment toward {customerName || "this customer"}&apos;s project balance.</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="min-h-11 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary" onClick={() => { setConfirming(null); void post(`/api/work-projects/${projectId}/payments/${payment.id}`, { action: "confirm" }); }}>Confirm payment</button>
                    <button type="button" className="min-h-11 rounded-sales-md border border-sales-border px-4 text-[14px]" onClick={() => setConfirming(null)}>Cancel</button>
                  </div>
                </div>
              ) : null}
              {commercial.canManage && payment.status === "CONFIRMED" ? (
                <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => {
                  const reason = window.prompt("Reason for reversing this payment");
                  if (reason) void post(`/api/work-projects/${projectId}/payments/${payment.id}`, { action: "reverse", reason });
                }}>Reverse payment</button>
              ) : null}
              {documentsEnabled ? (
                <label className="mt-3 flex min-h-16 cursor-pointer items-center justify-center rounded-sales-md border border-dashed border-sales-border text-[15px] font-semibold">
                  Add proof
                  <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void uploadCompanyDocument(clientId, file).then((uploaded) => {
                      if (!uploaded.ok) {
                        setError(uploaded.error);
                        return;
                      }
                      void post(`/api/work-projects/${projectId}/payments/${payment.id}`, { action: "proof", documentId: uploaded.documentId });
                    });
                  }} />
                </label>
              ) : <p className="mt-2 text-sales-text-muted">Documents are off for this company, so proof cannot be stored here.</p>}
            </li>
          ))}
        </ul>
      </section>
      {error ? <p className="text-[13px] text-sales-danger-fg">{error}</p> : null}
    </div>
  );
}

export function ProjectEquipmentPanel({
  projectId,
  commercial,
}: {
  projectId: string;
  commercial: ProjectCommercialSnapshot;
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(commercial.locations[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");

  async function post(body: unknown) {
    const res = await fetch(`/api/work-projects/${projectId}/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not update equipment.");
      return;
    }
    setError("");
    router.refresh();
  }

  const missing = commercial.equipment.filter((row) => row.missing > 0);
  const procurement = missing.filter((row) => row.supplierName || row.leadTimeDays != null);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-sales-text-secondary">Equipment readiness</p>
        <p className="mt-1 text-[1.5rem] font-semibold">{commercial.readiness.equipment}</p>
        {missing.length ? <p className="mt-1 text-[15px]">{missing.length === 1 ? "1 item missing" : `${missing.length} items missing`}</p> : null}
      </div>
      {commercial.quoteDiffers ? <p className="text-[14px]">Project equipment differs from the accepted quotation. The quotation was not changed.</p> : null}
      {procurement.length ? (
        <section>
          <h3 className="text-[1.05rem] font-semibold">Needs procurement</h3>
          <ul className="mt-2 space-y-2 text-[15px]">
            {procurement.map((row) => (
              <li key={row.id}>
                {row.missing} × {row.description}
                {row.supplierName ? <span className="block text-[14px] text-sales-text-secondary">Preferred supplier: {row.supplierName}</span> : null}
                {row.leadTimeDays != null ? <span className="block text-[14px] text-sales-text-secondary">Lead time: {row.leadTimeDays} days</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {commercial.canManage ? (
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void post({ action: "import" })}>Create equipment list from quotation</button>
          <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
            <option value="">Stock location</option>
            {commercial.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
          <button type="button" className="min-h-11 rounded-sales-md bg-segmiq-lime px-3 text-[14px] font-semibold text-sales-text-primary" onClick={() => void post({ action: "reserve", locationId })}>Reserve available equipment</button>
          <button type="button" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void post({ action: "release", equipmentId: null })}>Release reservation</button>
        </div>
      ) : null}
      {commercial.equipment.length === 0 ? <p className="text-[15px] text-sales-text-secondary">No equipment list yet.</p> : null}
      <ul className="divide-y divide-sales-border-subtle">
        {commercial.equipment.map((row) => (
          <li key={row.id} className="py-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[16px] font-semibold">{row.description}</p>
              <p className="text-[14px] font-medium">{!row.tracked ? "Not tracked" : row.missing > 0 ? `${row.missing} missing` : row.reserved >= row.required ? "Ready" : "Short"}</p>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-3 text-[14px]">
              <div><dt className="text-sales-text-secondary">Required</dt><dd className="font-semibold tabular-nums">{row.required}</dd></div>
              <div><dt className="text-sales-text-secondary">Available</dt><dd className="font-semibold tabular-nums">{row.tracked ? row.available : "—"}</dd></div>
              <div><dt className="text-sales-text-secondary">Reserved</dt><dd className="font-semibold tabular-nums">{row.tracked ? row.reserved : "—"}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      {commercial.canManage ? (
        <form className="flex flex-wrap gap-2" onSubmit={(event) => {
          event.preventDefault();
          void post({ action: "add", description, quantity: Number(quantity) });
        }}>
          <input required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Item" className="min-h-11 flex-1 rounded-sales-md border border-sales-border px-3 text-[13px]" />
          <input required type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="min-h-11 w-24 rounded-sales-md border border-sales-border px-3 text-[13px]" />
          <button type="submit" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold">Add item</button>
        </form>
      ) : null}
      {error ? <p className="text-[14px] text-sales-danger-fg">{error}</p> : null}
      <p className="text-[13px] text-sales-text-secondary">Reserving stock keeps it available for this project. Issue it from Delivery when the installation starts. Cancelling a project does not release stock until you confirm it here.</p>
    </div>
  );
}
