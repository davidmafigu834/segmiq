"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, Loader2, Upload } from "lucide-react";
import { Card, CardBody, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { HowToPay, type PaymentSettings } from "@/components/billing/HowToPay";
import { CRM_PLAN_LABELS, type CrmPlan } from "@/lib/billing/plans";
import { formatMoney, formatDate, PAYMENT_METHODS } from "@/lib/billing/format";

export type ClientSubscription = {
  plan: string;
  billingCycle: string;
  amount: number;
  currency: string;
  status: string;
  currentPeriodEnd: string | null;
} | null;

export type ClientInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  pdfUrl: string | null;
  hasPendingPayment: boolean;
};

const UNPAID = ["sent", "overdue"];

function planLabel(plan: string): string {
  return CRM_PLAN_LABELS[plan as CrmPlan] ?? plan;
}

export function ClientBillingView({
  subscription,
  invoices,
  outstanding,
  currency,
  settings,
}: {
  subscription: ClientSubscription;
  invoices: ClientInvoice[];
  outstanding: number;
  currency: string;
  settings: PaymentSettings;
}) {
  const router = useRouter();
  const payable = useMemo(
    () => invoices.filter((i) => UNPAID.includes(i.status) && !i.hasPendingPayment),
    [invoices]
  );

  const [invoiceId, setInvoiceId] = useState(payable[0]?.id ?? "");
  const [amount, setAmount] = useState(String(payable[0]?.amount ?? ""));
  const [method, setMethod] = useState("bank_transfer");
  const [methodDetail, setMethodDetail] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSelectInvoice(id: string) {
    setInvoiceId(id);
    const inv = payable.find((i) => i.id === id);
    if (inv) setAmount(String(inv.amount));
  }

  async function submit() {
    if (!invoiceId) {
      setError("Select an invoice to pay.");
      return;
    }
    if (!file) {
      setError("Attach a proof of payment.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const form = new FormData();
      form.set("invoiceId", invoiceId);
      form.set("amount", amount);
      form.set("method", method);
      form.set("method_detail", methodDetail);
      form.set("reference", reference);
      if (paidAt) form.set("paid_at", paidAt);
      form.set("proof", file);

      const res = await fetch("/api/billing/client/proof", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to submit payment");
        return;
      }
      setDone(true);
      setFile(null);
      setReference("");
      setMethodDetail("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <CardTitle>Subscription</CardTitle>
              {subscription ? <BillingStatusBadge status={subscription.status} /> : null}
            </div>
            {subscription ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Plan</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">
                    {planLabel(subscription.plan)}{" "}
                    <span className="text-[var(--text-tertiary)] capitalize">· {subscription.billingCycle}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Price</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">
                    {formatMoney(subscription.amount, subscription.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Next renewal</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No active subscription.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex h-full flex-col justify-center">
            <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Outstanding balance</p>
            <p
              className="mt-2 text-4xl text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              {formatMoney(outstanding, currency)}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="pb-2">
          <CardTitle>Invoices</CardTitle>
        </CardBody>
        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            No invoices yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-6"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--text-secondary)]">{inv.invoiceNumber}</span>
                  <BillingStatusBadge status={inv.status} />
                  {inv.hasPendingPayment ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--warning)]">
                      <Clock className="h-3.5 w-3.5" /> Payment under review
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[var(--text-tertiary)]">Due {formatDate(inv.dueAt)}</span>
                  <span className="text-sm tabular-nums text-[var(--text-primary)]">
                    {formatMoney(inv.amount, inv.currency)}
                  </span>
                  {inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-5">
            <div>
              <CardTitle>How to pay</CardTitle>
              <CardDescription>Pay by bank transfer or mobile money, then upload your proof.</CardDescription>
            </div>
            <HowToPay settings={settings} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-5">
            <div>
              <CardTitle>Upload payment proof</CardTitle>
              <CardDescription>
                Submit your payment details and receipt. The agency will confirm it shortly.
              </CardDescription>
            </div>

            {error ? (
              <div className="rounded-md border border-[var(--error-border)] bg-[var(--error-muted)] px-3.5 py-2.5 text-sm text-[var(--error)]">
                {error}
              </div>
            ) : null}
            {done ? (
              <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-muted)] px-3.5 py-2.5 text-sm text-[var(--success)]">
                Proof submitted. Your payment is now pending review.
              </div>
            ) : null}

            {payable.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">
                No invoices are currently awaiting payment.
              </p>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Invoice</span>
                  <select
                    value={invoiceId}
                    onChange={(e) => onSelectInvoice(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                  >
                    {payable.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoiceNumber} — {formatMoney(i.amount, i.currency)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                      Amount ({currency})
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
                      Reference / detail
                    </span>
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
                </div>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Proof file</span>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--bg-tertiary)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--text-primary)]"
                  />
                </label>
                <Button onClick={submit} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Submit payment proof
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
