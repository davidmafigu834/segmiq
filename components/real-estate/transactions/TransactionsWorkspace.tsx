"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, FileText, X } from "lucide-react";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import {
  Badge,
  Button,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  Field,
  IconButton,
  Input,
  SearchInput,
} from "@/components/sales/ui";
import type {
  TransactionEventRow,
  TransactionListRow,
  TransactionMilestoneRow,
} from "@/lib/real-estate/transaction-service";
import {
  isTransactionTerminal,
  reTransactionStatusLabel,
  type ReMilestoneStatus,
  type ReTransactionStatus,
  type ReTxnAction,
} from "@/lib/real-estate/transactions";
import { cn } from "@/lib/ui/cn";

type StatusTab = "active" | "in_progress" | "completed";

const TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
];

type TxnTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

function statusTone(status: string): TxnTone {
  if (status === "completed") return "success";
  if (status === "fallen_through" || status === "cancelled") return "danger";
  if (status === "in_progress") return "brand";
  if (status === "pending_compliance") return "warning";
  return "neutral";
}

function TransactionStatusPill({ status }: { status: string }) {
  return (
    <Badge tone={statusTone(status)} appearance="soft">
      {reTransactionStatusLabel(status)}
    </Badge>
  );
}

function initials(name: string | null): string {
  const parts = (name ?? "Buyer").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function emptyCopy(tab: StatusTab): { title: string; description: string } {
  if (tab === "active") {
    return {
      title: "No active transactions",
      description: "Accepted offers start a transaction here once compliance and progress begin.",
    };
  }
  if (tab === "in_progress") {
    return {
      title: "Nothing in progress",
      description: "Transactions moved past compliance show here until completion.",
    };
  }
  return {
    title: "No completed transactions",
    description: "Finished deals land here after keys, payment, and commission wrap up.",
  };
}

export function TransactionsWorkspace({
  clientId,
  variant,
  onSelectionChange,
}: {
  clientId: string;
  variant: "manager" | "agent";
  onSelectionChange?: (id: string | null) => void;
}) {
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [tab, setTab] = useState<StatusTab>("active");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TransactionListRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    active: 0,
    in_progress: 0,
    completed: 0,
    pending_compliance: 0,
    all: 0,
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const select = useCallback(
    (id: string | null) => {
      setOpenId(id);
      onSelectionChange?.(id);
    },
    [onSelectionChange]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tab });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/clients/${clientId}/transactions?${params.toString()}`);
    const j = (await res.json()) as {
      rows?: TransactionListRow[];
      counts?: Record<string, number>;
    };
    setRows(j.rows ?? []);
    if (j.counts) setCounts(j.counts);
    setLoading(false);
  }, [clientId, tab, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabCounts: Record<StatusTab, number> = {
    active: counts.active ?? 0,
    in_progress: counts.in_progress ?? 0,
    completed: counts.completed ?? 0,
  };

  const empty = emptyCopy(tab);

  const table = (
    <section className="flex min-h-[660px] min-w-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4">
        <div
          className="scrollbar-hide flex min-w-0 gap-4 overflow-x-auto overscroll-x-contain"
          role="tablist"
          aria-label="Transaction status"
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-[13px] transition-colors duration-150",
                  active
                    ? "font-semibold text-sales-text-primary"
                    : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
                )}
              >
                {item.label}
                <span className="tabular-nums text-sales-text-muted">{tabCounts[item.id]}</span>
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search buyer, property, agent…"
            className="min-w-0 w-full sm:w-[240px]"
          />
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="px-4 py-8 text-[13px] text-sales-text-muted sm:px-5">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<FileText className="h-4 w-4" strokeWidth={1.5} />}
            title={empty.title}
            description={empty.description}
            size="compact"
          />
        </div>
      ) : (
        <>
          <div className="hidden min-w-0 flex-1 overflow-x-auto md:block">
            <DataTableEl className="min-w-[860px]">
              <DataTableHead>
                <tr>
                  <DataTableTh>Buyer / property</DataTableTh>
                  <DataTableTh>Agreed</DataTableTh>
                  <DataTableTh>Status</DataTableTh>
                  <DataTableTh>Milestones</DataTableTh>
                  {variant === "manager" ? <DataTableTh>Agent</DataTableTh> : null}
                  <DataTableTh className="text-right">Updated</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    selected={row.id === openId}
                    className="h-[56px] cursor-pointer"
                    onClick={() => select(row.id)}
                  >
                    <DataTableTd>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-neutral-100 text-[11px] font-semibold text-sales-text-secondary">
                          {initials(row.buyerName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                            {row.buyerName ?? "Buyer"}
                          </p>
                          <p className="truncate text-[11px] text-sales-text-muted">
                            {row.propertyLabel}
                          </p>
                        </div>
                      </div>
                    </DataTableTd>
                    <DataTableTd>
                      <p className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                        {row.agreedPriceLabel}
                      </p>
                      {row.commissionTotalLabel ? (
                        <p className="truncate text-[11px] text-sales-text-muted">
                          Comm {row.commissionTotalLabel}
                        </p>
                      ) : null}
                    </DataTableTd>
                    <DataTableTd>
                      <TransactionStatusPill status={row.status} />
                    </DataTableTd>
                    <DataTableTd className="text-[12px] tabular-nums text-sales-text-secondary">
                      {row.milestonesDone}/{row.milestonesTotal}
                    </DataTableTd>
                    {variant === "manager" ? (
                      <DataTableTd className="text-[12px] text-sales-text-secondary">
                        {row.agentName ?? "—"}
                      </DataTableTd>
                    ) : null}
                    <DataTableTd className="text-right text-[11px] text-sales-text-muted">
                      {formatWhen(row.updatedAt)}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>
          <div className="divide-y divide-sales-border-subtle md:hidden">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sales-surface-hover",
                  row.id === openId && "bg-sales-brand-soft"
                )}
                onClick={() => select(row.id)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-neutral-100 text-[11px] font-semibold text-sales-text-secondary">
                  {initials(row.buyerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                    {row.buyerName ?? "Buyer"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                    {row.propertyLabel}
                    {" · "}
                    {row.agreedPriceLabel}
                  </p>
                </div>
                <TransactionStatusPill status={row.status} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );

  const panel = openId ? (
    <TransactionDetailPanel
      clientId={clientId}
      transactionId={openId}
      onClose={() => select(null)}
      onChanged={() => void load()}
      overlay={overlayPanel}
      stacked={stackedSplit}
    />
  ) : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3">
        <CompanyKpiCard
          item={{
            id: "active",
            label: "Active",
            value: String(counts.active ?? 0),
            supporting: "Open deals",
            icon: "deals",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "in_progress",
            label: "In progress",
            value: String(counts.in_progress ?? 0),
            supporting: "Past compliance",
            icon: "pipeline",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "completed",
            label: "Completed",
            value: String(counts.completed ?? 0),
            supporting: "Closed successfully",
            icon: "won",
          }}
        />
      </div>

      {openId && !overlayPanel ? (
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,30%)]">
          {table}
          <div className="min-h-0 xl:sticky xl:top-0">{panel}</div>
        </div>
      ) : (
        table
      )}

      {openId && overlayPanel ? panel : null}
    </div>
  );
}

type DetailPayload = {
  transaction: Record<string, unknown>;
  milestones: TransactionMilestoneRow[];
  events: TransactionEventRow[];
  listing: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
};

function TransactionDetailPanel({
  clientId,
  transactionId,
  onClose,
  onChanged,
  overlay = true,
  stacked = false,
}: {
  clientId: string;
  transactionId: string;
  onClose: () => void;
  onChanged: () => void;
  overlay?: boolean;
  stacked?: boolean;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [fallenReason, setFallenReason] = useState("");
  const [showFallen, setShowFallen] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/transactions/${transactionId}`);
      const j = (await res.json()) as DetailPayload & { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Could not load transaction.");
        setData(null);
        return;
      }
      setData(j);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, transactionId]);

  const txn = data?.transaction;
  const status = (txn?.status as ReTransactionStatus) ?? "draft";
  const closed = isTransactionTerminal(status);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setToast(j.error ?? "Action failed.");
        return;
      }
      setShowDeposit(false);
      setShowFallen(false);
      setDepositAmount("");
      setFallenReason("");
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: ReTxnAction, extra?: Record<string, unknown>) {
    await mutate({ action, ...extra });
  }

  async function toggleMilestone(m: TransactionMilestoneRow) {
    if (closed) return;
    const next: ReMilestoneStatus = m.status === "done" ? "pending" : "done";
    await mutate({
      action: "update_milestone",
      milestone_id: m.id,
      status: next,
    });
  }

  const contactName =
    (data?.contact?.name as string | null | undefined) ??
    (txn?.buyer_name as string | null | undefined) ??
    "Buyer";
  const property =
    data?.listing && typeof data.listing === "object"
      ? [data.listing.address, data.listing.suburb].filter(Boolean).join(", ") || "Property"
      : "Property";
  const agreed =
    txn?.agreed_price != null
      ? Number(txn.agreed_price).toLocaleString(undefined, {
          style: "currency",
          currency: (txn.currency as string) || "USD",
          maximumFractionDigits: 0,
        })
      : "—";

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-sales-border-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-sales-text-primary">{contactName}</p>
          <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">{property}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TransactionStatusPill status={status} />
            <span className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
              {agreed}
            </span>
          </div>
        </div>
        <IconButton aria-label="Close transaction details" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-[13px] text-sales-text-muted">Loading…</p>
        ) : error ? (
          <p className="text-[13px] text-sales-danger-fg">{error}</p>
        ) : (
          <>
            {!closed ? (
              <div className="flex flex-wrap gap-2">
                {status === "pending_compliance" || status === "draft" ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void runAction("start_progress")}
                  >
                    Start progress
                  </Button>
                ) : null}
                {status === "in_progress" ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void runAction("sign_agreement")}
                    >
                      Sign agreement
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setShowDeposit((v) => !v)}
                    >
                      Record deposit
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void runAction("complete")}
                    >
                      Complete
                    </Button>
                  </>
                ) : null}
                {(status === "pending_compliance" || status === "in_progress") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setShowFallen((v) => !v)}
                  >
                    Fallen through
                  </Button>
                )}
              </div>
            ) : null}

            {showDeposit ? (
              <div className="space-y-2 rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3">
                <Field label="Deposit amount">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={busy || !depositAmount}
                  onClick={() =>
                    void runAction("record_deposit", {
                      deposit_amount: Number(depositAmount),
                    })
                  }
                >
                  Save deposit
                </Button>
              </div>
            ) : null}

            {showFallen ? (
              <div className="space-y-2 rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3">
                <Field label="Reason">
                  <Input
                    value={fallenReason}
                    onChange={(e) => setFallenReason(e.target.value)}
                    placeholder="Why did it fall through?"
                  />
                </Field>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runAction("fallen_through", { reason: fallenReason || null })
                  }
                >
                  Confirm fallen through
                </Button>
              </div>
            ) : null}

            {toast ? <p className="text-[12px] text-sales-danger-fg">{toast}</p> : null}

            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-sales-text-muted">
                Milestones
              </h3>
              <ul className="space-y-1.5">
                {(data?.milestones ?? []).map((m) => {
                  const done = m.status === "done" || m.status === "skipped";
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={closed || busy}
                        onClick={() => void toggleMilestone(m)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-colors",
                          closed
                            ? "cursor-default"
                            : "hover:bg-sales-surface-hover disabled:opacity-60"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                            done
                              ? "border-sales-success/30 bg-sales-success-soft text-sales-success-fg"
                              : "border-sales-border bg-sales-surface text-transparent"
                          )}
                        >
                          <Check className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-[13px]",
                              done
                                ? "text-sales-text-secondary line-through"
                                : "font-medium text-sales-text-primary"
                            )}
                          >
                            {m.label}
                          </span>
                          {m.notes ? (
                            <span className="block text-[11px] text-sales-text-muted">{m.notes}</span>
                          ) : null}
                        </span>
                        <Badge
                          tone={
                            m.status === "done"
                              ? "success"
                              : m.status === "blocked"
                                ? "danger"
                                : m.status === "in_progress"
                                  ? "brand"
                                  : "neutral"
                          }
                          appearance="soft"
                          size="sm"
                        >
                          {m.status.replace(/_/g, " ")}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-sales-text-muted">
                Activity
              </h3>
              {(data?.events ?? []).length === 0 ? (
                <p className="text-[12px] text-sales-text-muted">No events yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(data?.events ?? []).slice(0, 12).map((e) => (
                    <li key={e.id} className="text-[12px]">
                      <p className="font-medium text-sales-text-primary">
                        {e.eventType.replace(/_/g, " ")}
                      </p>
                      {e.note ? (
                        <p className="text-sales-text-secondary">{e.note}</p>
                      ) : null}
                      <p className="text-sales-text-muted">
                        {formatWhen(e.createdAt)}
                        {e.createdByName ? ` · ${e.createdByName}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-40 flex justify-end bg-black/30",
          stacked ? "items-stretch" : "items-start pt-0"
        )}
        onClick={onClose}
      >
        <aside
          className={cn(
            "flex h-full w-full max-w-[420px] flex-col border-l border-sales-border bg-sales-surface shadow-sales-card",
            stacked && "max-w-none"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {body}
        </aside>
      </div>
    );
  }

  return (
    <aside className="flex min-h-[660px] flex-col overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      {body}
    </aside>
  );
}
