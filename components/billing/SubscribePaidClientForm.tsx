"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Card, CardBody, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CRM_PLAN_LABELS,
  CRM_PLAN_MONTHLY_USD,
  getPlanAmount,
  type BillingCycle,
  type CrmPlan,
} from "@/lib/billing/plans";
import { PAYMENT_METHODS } from "@/lib/billing/format";

export type ClientOption = { id: string; name: string };

const PLANS: CrmPlan[] = ["starter", "growth", "scale"];

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SubscribePaidClientForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [plan, setPlan] = useState<CrmPlan>("starter");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [amount, setAmount] = useState(String(getPlanAmount("starter", "monthly")));
  const [periodStart, setPeriodStart] = useState(todayInputValue());
  const [paymentAmount, setPaymentAmount] = useState(String(getPlanAmount("starter", "monthly")));
  const [method, setMethod] = useState("bank_transfer");
  const [methodDetail, setMethodDetail] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayInputValue());
  const [notifyClient, setNotifyClient] = useState(true);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  function onPlanChange(p: CrmPlan) {
    setPlan(p);
    const a = getPlanAmount(p, cycle);
    setAmount(String(a));
    setPaymentAmount(String(a));
  }

  function onCycleChange(c: BillingCycle) {
    setCycle(c);
    const a = getPlanAmount(plan, c);
    setAmount(String(a));
    setPaymentAmount(String(a));
  }

  async function submit() {
    if (!clientId) {
      setError("Select a client.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/billing/onboard-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          plan,
          billingCycle: cycle,
          amount: Number(amount),
          periodStart,
          paymentAmount: Number(paymentAmount),
          method,
          methodDetail,
          reference,
          paidAt,
          notifyClient,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to subscribe client");
        return;
      }
      setDone(
        `Active subscription created. Invoice ${data.invoiceNumber}${data.receiptNumber ? `, receipt ${data.receiptNumber}` : ""}.`
      );
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (clients.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Subscribe a paid client</CardTitle>
            <CardDescription>
              Record an already-completed payment and set up billing in one step. Picks an existing client only.
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
            <UserPlus className="h-4 w-4" />
            {open ? "Hide form" : "Subscribe paid client"}
          </Button>
        </div>

        {open ? (
          <div className="space-y-5 border-t border-[var(--border)] pt-5">
            {error ? (
              <div className="rounded-md border border-[var(--error-border)] bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
                {error}
              </div>
            ) : null}
            {done ? (
              <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-muted)] px-4 py-3 text-sm text-[var(--success)]">
                {done}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block sm:col-span-2 lg:col-span-1">
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Client</span>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                >
                  {sortedClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Plan</span>
                <select
                  value={plan}
                  onChange={(e) => onPlanChange(e.target.value as CrmPlan)}
                  className="mt-1 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {CRM_PLAN_LABELS[p]} (USD {CRM_PLAN_MONTHLY_USD[p]}/mo)
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Billing cycle</span>
                <select
                  value={cycle}
                  onChange={(e) => onCycleChange(e.target.value as BillingCycle)}
                  className="mt-1 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Amount (USD)</span>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Period start</span>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Payment amount</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
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
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Method detail</span>
                <Input value={methodDetail} onChange={(e) => setMethodDetail(e.target.value)} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Reference</span>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Date paid</span>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="mt-1" />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={notifyClient}
                onChange={(e) => setNotifyClient(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              Notify client by email (invoice + receipt PDFs)
            </label>

            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Subscribe paid client
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
