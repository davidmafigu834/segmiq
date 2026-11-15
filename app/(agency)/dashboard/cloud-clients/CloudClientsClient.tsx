"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { WorkbenchMenu } from "@/components/platform/WorkbenchMenu";
import { EmptyNote, Panel, WorkRow } from "@/components/platform/workbench";
import { CloudTeamModal } from "./CloudTeamModal";

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

const inputCls = "input-base w-full";
const labelCls = "mb-1 block text-[13px] text-[var(--text-secondary)]";
const planOptionBase = "flex flex-1 flex-col items-center rounded-[6px] border px-3 py-2.5 text-[13px] font-semibold";

export function CloudClientsClient({
  initialClients,
  supabaseDashboardBase,
}: {
  initialClients: CloudClientRow[];
  supabaseDashboardBase: string;
}) {
  const [clients, setClients] = useState<CloudClientRow[]>(initialClients);

  const [modalClient, setModalClient] = useState<CloudClientRow | null>(null);
  const [modalPlan, setModalPlan] = useState("starter");
  const [modalBilling, setModalBilling] = useState<"monthly" | "annual">("monthly");
  const [modalPaymentStatus, setModalPaymentStatus] = useState("unpaid");
  const [modalNextDate, setModalNextDate] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [teamModalClient, setTeamModalClient] = useState<CloudClientRow | null>(null);

  function openModal(c: CloudClientRow) {
    setModalClient(c);
    setModalPlan(c.plan ?? "starter");
    setModalBilling((c.billing_period ?? "monthly") as "monthly" | "annual");
    setModalPaymentStatus(c.payment_status ?? "unpaid");
    setModalNextDate(c.next_payment_date ?? "");
    setModalNotes(c.payment_notes ?? "");
    setSaveError("");
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
  }

  async function deactivateClient(c: CloudClientRow) {
    if (!window.confirm(`Deactivate "${c.name}"? They will no longer be able to log in.`)) return;
    setDeactivating(c.id);
    await fetch(`/api/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    setDeactivating(null);
    setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: false } : x)));
  }

  return (
    <div className="space-y-8">
      <Panel title="Register" count={clients.length}>
        {clients.length === 0 ? (
          <EmptyNote title="No cloud organisations" detail="Organisations with cloud access appear here." />
        ) : (
          <ul>
            {clients.map((c) => {
              const manager = c.users.find((user) => user.role === "CLIENT_MANAGER");
              return (
                <WorkRow
                  key={c.id}
                  name={c.name}
                  meta={`${c.plan ?? "starter"} · ${c.billing_period ?? "monthly"} · ${c.payment_status ?? "unpaid"}`}
                  detail={`${manager?.email ?? "No manager"} · ${c.users.length} people · ${formatBytes(clientStorageBytes(c))} · joined ${formatDate(c.created_at)}`}
                  mark={!c.is_active || c.payment_status === "overdue" ? "overdue" : "waiting"}
                  action="Open"
                  href={`/dashboard/clients/${c.id}`}
                  extra={
                    <WorkbenchMenu
                      label={`Actions for ${c.name}`}
                      items={[
                        { id: "plan", label: "Change plan", onSelect: () => openModal(c) },
                        {
                          id: "billing",
                          label: `Switch to ${c.billing_period === "annual" ? "monthly" : "annual"}`,
                          onSelect: () => void toggleBillingPeriod(c),
                        },
                        { id: "team", label: "Manage cloud team", onSelect: () => setTeamModalClient(c) },
                        {
                          id: "supabase",
                          label: "View in Supabase",
                          onSelect: () => window.open(`${supabaseDashboardBase}&filter=id:eq:${c.id}`, "_blank", "noopener,noreferrer"),
                        },
                        ...(c.is_active
                          ? [{ id: "deactivate", label: deactivating === c.id ? "Deactivating…" : "Deactivate account", destructive: true, disabled: deactivating === c.id, onSelect: () => void deactivateClient(c) }]
                          : []),
                      ]}
                    />
                  }
                />
              );
            })}
          </ul>
        )}
      </Panel>

      {teamModalClient && (
        <CloudTeamModal
          clientId={teamModalClient.id}
          clientName={teamModalClient.name}
          onClose={() => setTeamModalClient(null)}
        />
      )}

      {/* Change plan modal */}
      {modalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div role="dialog" aria-modal="true" aria-labelledby="cloud-plan-title" className="relative w-full max-w-md rounded-[6px] border border-[var(--border)] bg-[var(--bg-primary)] p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="cloud-plan-title" className="text-[18px] font-semibold text-[var(--text-primary)]">
                  Update plan for {modalClient.name}
                </h2>
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
                className="textarea-base w-full resize-none"
              />
            </div>

            {saveError && (
              <p className="mb-3 text-[12px] text-red-500">{saveError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="btn-secondary-dark flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveChange()}
                disabled={saving}
                className="btn-primary flex flex-1 items-center justify-center gap-2"
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
