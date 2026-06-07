"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Paperclip, Plus } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { CRM_PLAN_LABELS, type CrmPlan } from "@/lib/billing/plans";
import { formatMoney, formatDate, methodLabel, PAYMENT_METHODS } from "@/lib/billing/format";

export type InvoiceDetail = {
  id: string;
  subscriptionId: string;
  invoiceNumber: string;
  clientName: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
};

export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  methodDetail: string | null;
  reference: string | null;
  status: string;
  recordedVia: string;
  paidAt: string | null;
  rejectedReason: string | null;
  proofs: { url: string; name: string }[];
  receipt: { number: string; pdfUrl: string | null } | null;
};

function planLabel(plan: string): string {
  return CRM_PLAN_LABELS[plan as CrmPlan] ?? plan;
}

export function InvoiceDetailClient({
  detail,
  payments,
}: {
  detail: InvoiceDetail;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRecord, setShowRecord] = useState(false);

  const [amount, setAmount] = useState(String(detail.amount));
  const [method, setMethod] = useState("bank_transfer");
  const [methodDetail, setMethodDetail] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const period =
    detail.periodStart && detail.periodEnd
      ? `${formatDate(detail.periodStart)} – ${formatDate(detail.periodEnd)}`
      : "Current period";

  async function recordPayment() {
    setBusy("record");
    setError(null);
    try {
      const form = new FormData();
      form.set("invoiceId", detail.id);
      form.set("amount", amount);
      form.set("method", method);
      form.set("method_detail", methodDetail);
      form.set("reference", reference);
      if (paidAt) form.set("paid_at", paidAt);
      if (file) form.set("proof", file);

      const res = await fetch("/api/billing/payments/record", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to record payment");
        return;
      }
      setShowRecord(false);
      setMethodDetail("");
      setReference("");
      setFile(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  function voidInvoice() {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    setBusy("void");
    setError(null);
    fetch(`/api/billing/invoices/${detail.id}/void`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setError(data.error ?? "Failed to void invoice");
        else router.refresh();
      })
      .catch(() => setError("Network error"))
      .finally(() => setBusy(null));
  }

  const canRecord = detail.status !== "void" && detail.status !== "paid";

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/billing/subscriptions/${detail.subscriptionId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to subscription
      </Link>

      {error ? (
        <div className="rounded-md border border-[var(--error-border)] bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}

      <Card>
        <CardBody className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm text-[var(--text-tertiary)]">{detail.invoiceNumber}</p>
              <p
                className="mt-1 text-3xl text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
              >
                {formatMoney(detail.amount, detail.currency)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <BillingStatusBadge status={detail.status} />
              {detail.pdfUrl ? (
                <a
                  href={detail.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-white/[0.03]"
                >
                  <FileText className="h-4 w-4" /> View PDF
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Segmiq CRM — {planLabel(detail.plan)} plan
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{period}</p>
              </div>
              <p className="text-sm tabular-nums text-[var(--text-primary)]">
                {formatMoney(detail.amount, detail.currency)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Bill to</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{detail.clientName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Issued</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(detail.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Due</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(detail.dueAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Paid</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(detail.paidAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canRecord ? (
              <Button onClick={() => setShowRecord((v) => !v)} disabled={busy !== null}>
                <Plus className="h-4 w-4" /> Record manual payment
              </Button>
            ) : null}
            {detail.status !== "void" && detail.status !== "paid" ? (
              <Button variant="destructive" onClick={voidInvoice} disabled={busy !== null}>
                {busy === "void" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Void invoice
              </Button>
            ) : null}
          </div>

          {showRecord ? (
            <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]/40 p-4">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Record a payment you have already verified
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                    Amount ({detail.currency})
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Method</span>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                    Method detail
                  </span>
                  <Input
                    value={methodDetail}
                    onChange={(e) => setMethodDetail(e.target.value)}
                    placeholder="e.g. EcoCash, bank name"
                    className="mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Reference</span>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Transaction reference"
                    className="mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Date paid</span>
                  <Input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                    Proof (optional)
                  </span>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--bg-tertiary)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--text-primary)]"
                  />
                </label>
              </div>
              <div className="flex gap-3">
                <Button onClick={recordPayment} disabled={busy !== null}>
                  {busy === "record" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Record &amp; confirm payment
                </Button>
                <Button variant="ghost" onClick={() => setShowRecord(false)} disabled={busy !== null}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pb-2">
          <CardTitle>Payments</CardTitle>
        </CardBody>
        {payments.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            No payments recorded against this invoice.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {payments.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {formatMoney(p.amount, p.currency)}
                    </span>
                    <BillingStatusBadge status={p.status} />
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {methodLabel(p.method)}
                      {p.methodDetail ? ` · ${p.methodDetail}` : ""}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {p.recordedVia === "agency_manual" ? "Recorded by agency" : "Client upload"}
                    {p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ""}
                  </span>
                </div>
                {p.reference ? (
                  <p className="text-xs text-[var(--text-tertiary)]">Ref: {p.reference}</p>
                ) : null}
                {p.rejectedReason ? (
                  <p className="text-xs text-[var(--error)]">Rejected: {p.rejectedReason}</p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  {p.receipt?.pdfUrl ? (
                    <a
                      href={p.receipt.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" /> Receipt {p.receipt.number}
                    </a>
                  ) : p.status === "confirmed" ? (
                    <span className="text-xs text-[var(--text-tertiary)]">Receipt pending</span>
                  ) : null}
                  {p.proofs.map((pr) => (
                    <a
                      key={pr.url}
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" /> {pr.name}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
