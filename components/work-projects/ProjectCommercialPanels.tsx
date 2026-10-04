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
  const trackedRequired = commercial.equipment.filter((row) => row.tracked).reduce((sum, row) => sum + row.required, 0);
  const trackedReserved = commercial.equipment.filter((row) => row.tracked).reduce((sum, row) => sum + row.reserved, 0);
  const missing = commercial.equipment.filter((row) => row.missing > 0);
  return (
    <section className="space-y-3">
      {commercial.attention.length ? (
        <ul className="space-y-1 text-[13px] font-medium text-sales-danger-fg">
          {commercial.attention.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[12px] text-sales-text-muted">Payment</p>
          <p className="mt-1 text-[14px] font-medium">{money(commercial.received, commercial.currency)} / {money(commercial.projectValue, commercial.currency)} received</p>
          <p className="text-[13px] text-sales-text-secondary">{commercial.readiness.commercial}</p>
        </div>
        <div>
          <p className="text-[12px] text-sales-text-muted">Equipment</p>
          <p className="mt-1 text-[14px] font-medium">{commercial.readiness.equipment === "Not required" ? "Not required" : `${trackedReserved} / ${trackedRequired} reserved`}</p>
          <p className="text-[13px] text-sales-text-secondary">{missing[0] ? `${missing[0].missing} ${missing[0].description} missing` : commercial.readiness.equipment}</p>
        </div>
        <div>
          <p className="text-[12px] text-sales-text-muted">Next step</p>
          <p className="mt-1 text-[14px] font-medium">{commercial.readiness.nextStep}</p>
        </div>
      </div>
      {commercial.quoteDiffers ? <p className="text-[13px] font-medium">Project equipment differs from the accepted quotation.</p> : null}
    </section>
  );
}

export function ProjectPaymentsPanel({
  projectId,
  clientId,
  commercial,
  documentsEnabled,
}: {
  projectId: string;
  clientId: string;
  commercial: ProjectCommercialSnapshot;
  documentsEnabled: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [termId, setTermId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

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
      <dl className="grid gap-3 sm:grid-cols-4">
        <div><dt className="text-[12px] text-sales-text-muted">Project total</dt><dd className="text-[18px] font-semibold">{money(commercial.projectValue, commercial.currency)}</dd></div>
        <div><dt className="text-[12px] text-sales-text-muted">Received</dt><dd className="text-[18px] font-semibold">{money(commercial.received, commercial.currency)}</dd></div>
        <div><dt className="text-[12px] text-sales-text-muted">Outstanding</dt><dd className="text-[18px] font-semibold">{money(commercial.outstanding, commercial.currency)}</dd></div>
        <div><dt className="text-[12px] text-sales-text-muted">Status</dt><dd className="text-[18px] font-semibold">{commercial.paymentStatus.replaceAll("_", " ")}</dd></div>
      </dl>
      {commercial.canManage ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void post(`/api/work-projects/${projectId}/payment-terms`, { action: "import" })}>Import payment schedule</button>
          <button type="button" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void post(`/api/work-projects/${projectId}/payment-terms`, { action: "requirement", required: !commercial.paymentRequired })}>{commercial.paymentRequired ? "Mark payment not required" : "Require payment"}</button>
        </div>
      ) : null}
      <section>
        <h3 className="text-[15px] font-semibold">Milestones</h3>
        {commercial.terms.length === 0 ? <p className="mt-1 text-[13px] text-sales-text-secondary">No payment schedule yet.</p> : null}
        <ul className="mt-2 space-y-2">
          {commercial.terms.map((term) => (
            <li key={term.id} className="rounded-sales-md border border-sales-border px-3 py-2 text-[13px]">
              <span className="font-medium">{term.label}</span> · {money(term.resolvedAmount, commercial.currency)} · {term.satisfied ? "Paid" : "Pending"}
              {term.overdue ? " · Overdue" : ""}
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
        <h3 className="sm:col-span-2 text-[15px] font-semibold">Record payment</h3>
        <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]" />
        <input required type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]" />
        <select value={method} onChange={(event) => setMethod(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
          {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
        <select value={termId} onChange={(event) => setTermId(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
          <option value="">Apply to milestone</option>
          {commercial.terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
        </select>
        <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]" />
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]" />
        <button type="submit" className="min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white">Record as pending</button>
      </form>
      <section>
        <h3 className="text-[15px] font-semibold">History</h3>
        <ul className="mt-2 space-y-2">
          {commercial.payments.map((payment) => (
            <li key={payment.id} className="rounded-sales-md border border-sales-border px-3 py-3 text-[13px]">
              <p className="font-medium">{money(Number(payment.amount), payment.currency)} · {payment.status} · {payment.payment_method.replaceAll("_", " ")}</p>
              <p className="text-sales-text-secondary">{new Date(payment.paid_at).toLocaleString()} {payment.reference ? `· ${payment.reference}` : ""} {payment.proofCount ? "· Proof attached" : ""}</p>
              {commercial.canManage && payment.status === "PENDING" ? (
                <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => void post(`/api/work-projects/${projectId}/payments/${payment.id}`, { action: "confirm" })}>Confirm payment</button>
              ) : null}
              {commercial.canManage && payment.status === "CONFIRMED" ? (
                <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => {
                  const reason = window.prompt("Reason for reversing this payment");
                  if (reason) void post(`/api/work-projects/${projectId}/payments/${payment.id}`, { action: "reverse", reason });
                }}>Reverse payment</button>
              ) : null}
              {documentsEnabled ? (
                <label className="mt-2 block text-[12px]">
                  Attach proof
                  <input type="file" accept="image/*,.pdf" className="mt-1 block w-full text-[13px]" onChange={(event) => {
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
  return (
    <div className="space-y-5">
      {commercial.quoteDiffers ? <p className="text-[13px] font-medium">Project equipment differs from the accepted quotation. The quotation was not changed.</p> : null}
      {missing.length ? (
        <section>
          <h3 className="text-[15px] font-semibold">Procurement required</h3>
          <ul className="mt-2 space-y-1 text-[13px]">
            {missing.map((row) => (
              <li key={row.id}>{row.missing} × {row.description}{row.supplierName ? ` · ${row.supplierName}` : ""}{row.supplierSku ? ` · ${row.supplierSku}` : ""}{row.leadTimeDays != null ? ` · ${row.leadTimeDays} days` : ""}</li>
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
          <button type="button" className="min-h-11 rounded-sales-md bg-sales-text-primary px-3 text-[13px] font-semibold text-white" onClick={() => void post({ action: "reserve", locationId })}>Reserve available equipment</button>
          <button type="button" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void post({ action: "release", equipmentId: null })}>Release reservation</button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-wide text-sales-text-muted">
            <tr>{["Item", "Required", "Available", "Reserved", "Missing", "Status"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody>
            {commercial.equipment.map((row) => (
              <tr key={row.id} className="border-t border-sales-border">
                <td className="px-2 py-2">{row.description}{row.cost != null ? ` · cost ${row.cost}` : ""}</td>
                <td className="px-2 py-2">{row.required}</td>
                <td className="px-2 py-2">{row.tracked ? row.available : "—"}</td>
                <td className="px-2 py-2">{row.tracked ? row.reserved : "—"}</td>
                <td className="px-2 py-2">{row.tracked ? row.missing : "—"}</td>
                <td className="px-2 py-2">{row.status.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      {error ? <p className="text-[13px] text-sales-danger-fg">{error}</p> : null}
      <p className="text-[12px] text-sales-text-muted">Reserving stock does not remove it from on hand. Issuing equipment happens in a later phase. Cancelling a project does not release stock until you confirm it here.</p>
    </div>
  );
}
