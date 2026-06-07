"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { CRM_PLAN_LABELS, type CrmPlan } from "@/lib/billing/plans";
import { formatMoney, formatDate } from "@/lib/billing/format";

export type SubscriptionDetail = {
  id: string;
  clientName: string;
  plan: string;
  billingCycle: string;
  amount: number;
  currency: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceDays: number;
  startedAt: string | null;
  cancelledAt: string | null;
};

export type InvoiceHistoryRow = {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  pdfUrl: string | null;
};

const PLAN_OPTIONS: CrmPlan[] = ["starter", "growth", "scale"];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">{label}</p>
      <div className="mt-1 text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

export function SubscriptionDetailClient({
  detail,
  history,
}: {
  detail: SubscriptionDetail;
  history: InvoiceHistoryRow[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(detail.plan);
  const [cycle, setCycle] = useState(detail.billingCycle);
  const [amount, setAmount] = useState(String(detail.amount));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function call(action: string, fn: () => Promise<Response>) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (action === "issue") {
        setNotice(
          data.alreadyExisted
            ? `Invoice ${data.invoiceNumber} already exists for this period.`
            : `Issued ${data.invoiceNumber}${data.emailed ? " and emailed the client." : "."}`
        );
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  const saveChanges = () =>
    call("save", () =>
      fetch(`/api/billing/subscriptions/${detail.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing_cycle: cycle, amount: Number(amount) }),
      })
    );

  const cancel = () => {
    if (!confirm("Cancel this subscription? The client will stop renewing.")) return;
    void call("cancel", () =>
      fetch(`/api/billing/subscriptions/${detail.id}/cancel`, { method: "POST" })
    );
  };

  const issueInvoice = () =>
    call("issue", () =>
      fetch(`/api/billing/invoices/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: detail.id }),
      })
    );

  const dirty =
    plan !== detail.plan || cycle !== detail.billingCycle || Number(amount) !== detail.amount;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/billing"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" /> All subscriptions
      </Link>

      {error ? (
        <div className="rounded-md border border-[var(--error-border)] bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-muted)] px-4 py-3 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}

      <Card>
        <CardBody className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <CardTitle>Subscription</CardTitle>
            <BillingStatusBadge status={detail.status} />
          </div>

          <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
            <Field label="Client" value={detail.clientName} />
            <Field
              label="Current price"
              value={
                <span style={{ fontFamily: "var(--font-instrument-serif), serif" }} className="text-xl">
                  {formatMoney(detail.amount, detail.currency)}
                </span>
              }
            />
            <Field label="Grace days" value={detail.graceDays} />
            <Field label="Period start" value={formatDate(detail.currentPeriodStart)} />
            <Field label="Period end (renewal)" value={formatDate(detail.currentPeriodEnd)} />
            <Field label="Started" value={formatDate(detail.startedAt)} />
            {detail.cancelledAt ? (
              <Field label="Cancelled" value={formatDate(detail.cancelledAt)} />
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <CardTitle>Change plan</CardTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Plan</span>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {CRM_PLAN_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Billing cycle</span>
              <select
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Amount ({detail.currency})</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={saveChanges} disabled={!dirty || busy !== null}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button variant="primary" onClick={issueInvoice} disabled={busy !== null}>
              {busy === "issue" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Issue invoice for current period
            </Button>
            {detail.status !== "cancelled" ? (
              <Button variant="destructive" onClick={cancel} disabled={busy !== null}>
                {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancel subscription
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pb-0">
          <CardTitle>Invoice history</CardTitle>
        </CardBody>
        {history.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            No invoices issued yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow isHeader>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead align="right">Amount</TableHead>
                  <TableHead align="right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/billing/invoices/${inv.id}`}
                        className="font-mono text-xs text-[var(--text-primary)] hover:text-[var(--accent)]"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <BillingStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>{formatDate(inv.issuedAt)}</TableCell>
                    <TableCell>{formatDate(inv.dueAt)}</TableCell>
                    <TableCell align="right">{formatMoney(inv.amount, inv.currency)}</TableCell>
                    <TableCell align="right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
