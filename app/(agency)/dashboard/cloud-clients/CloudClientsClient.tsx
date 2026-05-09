"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, MoreHorizontal, X } from "lucide-react";

export type CloudClientRow = {
  id: string;
  name: string;
  plan: string;
  billing_period: string;
  payment_status: string;
  next_payment_date: string | null;
  payment_notes: string | null;
  created_at: string;
  is_active: boolean;
  users: Array<{ id: string; name: string; email: string; role: string; created_at: string }>;
  projects: Array<{ id: string; project_media: Array<{ file_size_bytes: number | null }> }>;
};

const PLAN_PRICES: Record<string, number> = { starter: 20, professional: 49, business: 99 };
const PLAN_ANNUAL: Record<string, number> = { starter: 200, professional: 490, business: 990 };

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function clientStorageBytes(c: CloudClientRow): number {
  return (c.projects ?? []).reduce(
    (total, p) =>
      total + (p.project_media ?? []).reduce((s, m) => s + (m.file_size_bytes ?? 0), 0),
    0
  );
}

function calcMRR(c: CloudClientRow): number {
  const plan = c.plan ?? "starter";
  if (c.billing_period === "annual") return (PLAN_ANNUAL[plan] ?? 0) / 12;
  return PLAN_PRICES[plan] ?? 0;
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "professional")
    return (
      <span style={{ background: "rgba(180,130,40,0.1)", color: "#7A5810", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
        Professional
      </span>
    );
  if (plan === "business")
    return (
      <span style={{ background: "#1C1410", color: "#D4FF4F", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
        Business
      </span>
    );
  return (
    <span style={{ background: "rgba(0,0,0,0.06)", color: "#666660", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
      Starter
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "paid")
    return (
      <span style={{ background: "rgba(46,125,94,0.1)", color: "#2E7D5E", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
        Paid
      </span>
    );
  if (status === "overdue")
    return (
      <span style={{ background: "rgba(232,96,44,0.1)", color: "#E8602C", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <AlertTriangle style={{ width: 11, height: 11 }} /> Overdue
      </span>
    );
  return (
    <span style={{ background: "rgba(0,0,0,0.06)", color: "#999990", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
      Unpaid
    </span>
  );
}

const inputCls = "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]";
const planOptionBase = "flex flex-1 flex-col items-center rounded-xl border-2 px-3 py-2.5 text-[12px] font-semibold transition-colors cursor-pointer";

export function CloudClientsClient({
  initialClients,
  supabaseDashboardBase,
}: {
  initialClients: CloudClientRow[];
  supabaseDashboardBase: string;
}) {
  const [clients, setClients] = useState<CloudClientRow[]>(initialClients);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [modalClient, setModalClient] = useState<CloudClientRow | null>(null);
  const [modalPlan, setModalPlan] = useState("starter");
  const [modalBilling, setModalBilling] = useState<"monthly" | "annual">("monthly");
  const [modalPaymentStatus, setModalPaymentStatus] = useState("unpaid");
  const [modalNextDate, setModalNextDate] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deactivating, setDeactivating] = useState<string | null>(null);

  function openModal(c: CloudClientRow) {
    setModalClient(c);
    setModalPlan(c.plan ?? "starter");
    setModalBilling((c.billing_period ?? "monthly") as "monthly" | "annual");
    setModalPaymentStatus(c.payment_status ?? "unpaid");
    setModalNextDate(c.next_payment_date ?? "");
    setModalNotes(c.payment_notes ?? "");
    setSaveError("");
    setOpenMenuId(null);
  }

  function closeModal() {
    setModalClient(null);
    setSaveError("");
  }

  async function saveChange() {
    if (!modalClient) return;
    setSaving(true);
    setSaveError("");
    const res = await fetch(`/api/admin/cloud-clients/${modalClient.id}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: modalPlan,
        billing_period: modalBilling,
        payment_status: modalPaymentStatus,
        next_payment_date: modalNextDate || null,
        payment_notes: modalNotes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setSaveError(d.error ?? "Failed to save");
      return;
    }
    setClients((prev) =>
      prev.map((c) =>
        c.id === modalClient.id
          ? {
              ...c,
              plan: modalPlan,
              billing_period: modalBilling,
              payment_status: modalPaymentStatus,
              next_payment_date: modalNextDate || null,
              payment_notes: modalNotes || null,
            }
          : c
      )
    );
    closeModal();
  }

  async function toggleBillingPeriod(c: CloudClientRow) {
    const newBilling = c.billing_period === "annual" ? "monthly" : "annual";
    const res = await fetch(`/api/admin/cloud-clients/${c.id}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: c.plan ?? "starter", billing_period: newBilling }),
    });
    if (res.ok) {
      setClients((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, billing_period: newBilling } : x))
      );
    }
    setOpenMenuId(null);
  }

  async function deactivateClient(c: CloudClientRow) {
    if (!window.confirm(`Deactivate "${c.name}"? They will no longer be able to log in.`)) return;
    setDeactivating(c.id);
    setOpenMenuId(null);
    await fetch(`/api/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    setDeactivating(null);
    setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: false } : x)));
  }

  const totalClients = clients.length;
  const payingClients = clients.filter((c) => c.plan && c.plan !== "starter").length;
  const mrr = clients.reduce((sum, c) => sum + calcMRR(c), 0);
  const overdueClients = clients.filter((c) => c.payment_status === "overdue");

  const statCard = (label: string, value: string | number, sub?: string) => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{label}</p>
      <p className="font-display text-[28px] leading-none text-[var(--text-primary)]">{value}</p>
      {sub && <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{sub}</p>}
    </div>
  );

  return (
    <div>
      <p className="mb-6 text-[13px] text-[var(--text-tertiary)]">Manage Leadstaq Cloud client plans and billing.</p>

      {/* Overdue warning banner */}
      {overdueClients.length > 0 && (
        <div style={{ background: "rgba(232,96,44,0.08)", border: "0.5px solid rgba(232,96,44,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle style={{ color: "#E8602C", width: 16, height: 16, flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: "#E8602C", margin: 0 }}>
            {overdueClients.length} client{overdueClients.length > 1 ? "s are" : " is"} overdue on payment.{" "}
            <strong>{overdueClients.map((c) => c.name).join(", ")}</strong>
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {statCard("Total Cloud Clients", totalClients)}
        {statCard("Paying Clients", payingClients, "Professional or Business plan")}
        {statCard("Est. MRR", `$${mrr.toFixed(0)}`, "Monthly recurring revenue")}
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center text-[13px] text-[var(--text-tertiary)]">
          No Cloud self-signup clients yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Billing</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-left">Storage</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-[var(--border)] last:border-0 ${!c.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--text-primary)]">{c.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {c.users.find((u) => u.role === "CLIENT_MANAGER")?.email ?? ""}
                      </p>
                      {!c.is_active && (
                        <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">(Inactive)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={c.plan ?? "starter"} />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] capitalize">
                      {c.billing_period ?? "monthly"}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentBadge status={c.payment_status ?? "unpaid"} />
                      {c.next_payment_date && (
                        <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                          Due {formatDate(c.next_payment_date)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatBytes(clientStorageBytes(c))}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {c.users.length}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          {deactivating === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {openMenuId === c.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
                              <button
                                onClick={() => openModal(c)}
                                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                              >
                                Change plan
                              </button>
                              <button
                                onClick={() => void toggleBillingPeriod(c)}
                                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                              >
                                Switch to {c.billing_period === "annual" ? "Monthly" : "Annual"}
                              </button>
                              <div className="h-px bg-[var(--border)] my-1" />
                              <a
                                href={`${supabaseDashboardBase}&filter=id:eq:${c.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setOpenMenuId(null)}
                                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                              >
                                View in Supabase
                                <ExternalLink className="ml-auto h-3 w-3 text-[var(--text-tertiary)]" />
                              </a>
                              <div className="h-px bg-[var(--border)] my-1" />
                              {c.is_active && (
                                <button
                                  onClick={() => void deactivateClient(c)}
                                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  Deactivate account
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Change plan modal */}
      {modalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Update plan for {modalClient.name}
                </p>
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  Current:{" "}
                  <span className="font-semibold capitalize">{modalClient.plan ?? "starter"}</span> ·{" "}
                  <span className="capitalize">{modalClient.billing_period ?? "monthly"}</span>
                </p>
              </div>
              <button onClick={closeModal} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Plan selector */}
            <div className="mb-4">
              <p className={labelCls}>Plan</p>
              <div className="flex gap-2">
                {(["starter", "professional", "business"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setModalPlan(p)}
                    className={`${planOptionBase} ${
                      modalPlan === p
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40"
                    }`}
                  >
                    <span className="capitalize">{p}</span>
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      ${PLAN_PRICES[p]}/mo
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Billing period */}
            <div className="mb-4">
              <p className={labelCls}>Billing period</p>
              <div className="flex">
                <button
                  onClick={() => setModalBilling("monthly")}
                  className={`flex-1 rounded-l-xl border py-2 text-[13px] font-semibold transition-colors ${
                    modalBilling === "monthly"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setModalBilling("annual")}
                  className={`flex-1 rounded-r-xl border-y border-r py-2 text-[13px] font-semibold transition-colors ${
                    modalBilling === "annual"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>

            {/* Payment status */}
            <div className="mb-4">
              <label className={labelCls}>Payment status</label>
              <select
                value={modalPaymentStatus}
                onChange={(e) => setModalPaymentStatus(e.target.value)}
                className={inputCls}
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Next payment date */}
            <div className="mb-4">
              <label className={labelCls}>Next payment date</label>
              <input
                type="date"
                value={modalNextDate}
                onChange={(e) => setModalNextDate(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Payment notes */}
            <div className="mb-5">
              <label className={labelCls}>Payment notes (optional)</label>
              <textarea
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="e.g. Paid via EcoCash on 8 May 2026, ref #12345"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>

            {saveError && (
              <p className="mb-3 text-[12px] text-red-500">{saveError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveChange()}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Saving…" : "Confirm change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
