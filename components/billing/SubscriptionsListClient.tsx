"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Search, Settings, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { CRM_PLAN_LABELS, type CrmPlan } from "@/lib/billing/plans";
import { formatMoney, formatDate } from "@/lib/billing/format";

export type SubscriptionRow = {
  id: string;
  clientName: string;
  plan: string;
  billingCycle: string;
  amount: number;
  currency: string;
  status: string;
  currentPeriodEnd: string | null;
  outstanding: number;
};

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
];

function planLabel(plan: string): string {
  return CRM_PLAN_LABELS[plan as CrmPlan] ?? plan;
}

export function SubscriptionsListClient({ rows }: { rows: SubscriptionRow[] }) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (q && !r.clientName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/billing/payments"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-white/[0.03]"
        >
          <Clock className="h-4 w-4" /> Pending payments
        </Link>
        <Link
          href="/dashboard/billing/settings"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-white/[0.03]"
        >
          <Settings className="h-4 w-4" /> Billing settings
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          tabs={STATUS_TABS}
          value={status}
          onValueChange={setStatus}
          aria-label="Filter subscriptions by status"
          className="overflow-x-auto"
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by client name"
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Wallet className="h-8 w-8 text-[var(--text-tertiary)]" strokeWidth={1.5} />
            <p className="text-sm text-[var(--text-secondary)]">
              {rows.length === 0 ? "No subscriptions yet." : "No subscriptions match your filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow isHeader>
                  <TableHead>Client</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next renewal</TableHead>
                  <TableHead align="right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/dashboard/billing/subscriptions/${r.id}`}
                        className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                      >
                        {r.clientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-[var(--text-primary)]">{planLabel(r.plan)}</span>
                      <span className="ml-2 text-xs text-[var(--text-tertiary)] capitalize">{r.billingCycle}</span>
                    </TableCell>
                    <TableCell>
                      <BillingStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>{formatDate(r.currentPeriodEnd)}</TableCell>
                    <TableCell align="right">
                      <span className={r.outstanding > 0 ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"}>
                        {formatMoney(r.outstanding, r.currency)}
                      </span>
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
