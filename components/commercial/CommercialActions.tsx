"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CommercialOverview } from "@/lib/commercial/account-repository";
import type { PlanChangePreview } from "@/lib/commercial/plan-change";
import { formatUsd } from "@/lib/commercial/catalogue";

type Account = NonNullable<CommercialOverview["account"]>;
type Grace = CommercialOverview["activeGrace"];
type LegacySubscription = CommercialOverview["legacySubscription"];

export function CommercialActions({ clientId, account, activeGrace, recommendedSeats, legacySubscription }: { clientId: string; account: Account | null; activeGrace: Grace; recommendedSeats: number; legacySubscription: LegacySubscription }) {
  const [modal, setModal] = useState<"plan" | "grace" | "end" | null>(null);
  return <><div className="flex flex-wrap gap-2">
    <Button size="sm" variant="secondary" onClick={() => setModal("plan")}>{account ? "Change plan" : "Prepare migration"}</Button>
    <Button size="sm" variant="secondary" disabled={Boolean(activeGrace)} onClick={() => setModal("grace")}>Set grace period</Button>
    {activeGrace ? <Button size="sm" variant="secondary" onClick={() => setModal("end")}>End grace period</Button> : null}
  </div>
  {modal === "plan" && account ? <PlanDialog clientId={clientId} account={account} onClose={() => setModal(null)} /> : null}
  {modal === "plan" && !account ? <MigrationDialog clientId={clientId} recommendedSeats={recommendedSeats} legacySubscription={legacySubscription} onClose={() => setModal(null)} /> : null}
  {modal === "grace" ? <GraceDialog clientId={clientId} onClose={() => setModal(null)} /> : null}
  {modal === "end" && activeGrace ? <EndGraceDialog clientId={clientId} grace={activeGrace} onClose={() => setModal(null)} /> : null}
  </>;
}

function MigrationDialog({ clientId, recommendedSeats, legacySubscription, onClose }: { clientId: string; recommendedSeats: number; legacySubscription: LegacySubscription; onClose: () => void }) {
  const suggestedEffectiveAt = legacySubscription?.currentPeriodEnd && new Date(legacySubscription.currentPeriodEnd) > new Date() ? legacySubscription.currentPeriodEnd : new Date().toISOString();
  const [form, setForm] = useState({ crmSku: legacySubscription?.plan.toLowerCase() === "starter" ? "crm_starter" : "crm_growth", aiSku: "", purchasedSeats: recommendedSeats, billingCycle: legacySubscription?.billingCycle === "annual" ? "annual" : "monthly", effectiveAt: toLocalInput(suggestedEffectiveAt), chargeHandling: "at_renewal", reason: "", agreementRef: "", idempotencyKey: crypto.randomUUID() });
  const [preview, setPreview] = useState<{ proposed: { recurringMonthlyUsdCents: number }; legacy: { plan: string; amount: number; currency: string }; consentRequired: true } | null>(null);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const payload = () => ({ ...form, aiSku: form.aiSku || null, effectiveAt: new Date(form.effectiveAt).toISOString() });
  async function submit(path: "preview" | "confirm") { setBusy(true); setMessage(""); try { const response = await fetch(`/api/admin/commercial/clients/${clientId}/migration/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Request failed"); if (path === "preview") setPreview(body); else window.location.reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); } finally { setBusy(false); } }
  return <Modal title="Prepare controlled migration" onClose={onClose}><div className="space-y-4">{!preview ? <>
    <p className="text-xs text-[var(--text-secondary)]">Historical amounts stay unchanged. This creates a separate v2 commercial account only after review and consent.</p>
    <Field label="CRM plan"><Select value={form.crmSku} onChange={(e) => setForm({ ...form, crmSku: e.target.value })}><option value="crm_starter">Starter</option><option value="crm_growth">Growth</option></Select></Field>
    <Field label="Agentic AI"><Select value={form.aiSku} onChange={(e) => setForm({ ...form, aiSku: e.target.value })}><option value="">None</option><option value="agentic_business">Agentic Business</option><option value="agentic_scale">Agentic Scale</option></Select></Field>
    <Field label="Purchased seats"><Input type="number" min={1} value={form.purchasedSeats} onChange={(e) => setForm({ ...form, purchasedSeats: Number(e.target.value) })} /></Field>
    <Field label="Effective date and time"><Input type="datetime-local" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} /></Field>
    <Field label="Reason"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
    <Field label="Customer consent evidence reference"><Input value={form.agreementRef} onChange={(e) => setForm({ ...form, agreementRef: e.target.value })} /></Field>
    <Button className="w-full" disabled={busy || form.reason.trim().length < 3} onClick={() => submit("preview")}>{busy ? "Calculating…" : "Preview migration"}</Button>
  </> : <><Summary label="Legacy terms" value={`${preview.legacy.currency} ${preview.legacy.amount} · ${preview.legacy.plan}`} /><Summary label="New monthly" value={formatUsd(preview.proposed.recurringMonthlyUsdCents)} /><Summary label="Evidence" value={form.agreementRef || "Missing"} /><p className="text-xs text-[var(--text-tertiary)]">This does not rewrite the legacy subscription or any historical invoice.</p><div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setPreview(null)}>Back</Button><Button className="flex-1" disabled={busy || form.agreementRef.trim().length < 3} onClick={() => submit("confirm")}>{busy ? "Recording…" : "Confirm migration"}</Button></div></>}{message ? <p role="status" className="text-sm text-[var(--warning)]">{message}</p> : null}</div></Modal>;
}

function PlanDialog({ clientId, account, onClose }: { clientId: string; account: Account; onClose: () => void }) {
  const [form, setForm] = useState({ crmSku: account.crmSku, aiSku: account.aiSku ?? "", purchasedSeats: account.purchasedSeats, billingCycle: account.billingCycle, effectiveAt: toLocalInput(account.renewalAt ?? new Date().toISOString()), chargeHandling: "at_renewal", reason: "", agreementRef: "", idempotencyKey: crypto.randomUUID() });
  const [preview, setPreview] = useState<PlanChangePreview | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const payload = () => ({ ...form, aiSku: form.aiSku || null, effectiveAt: new Date(form.effectiveAt).toISOString() });
  async function submit(path: "preview" | "confirm") { setBusy(true); setMessage(""); try { const response = await fetch(`/api/admin/commercial/clients/${clientId}/plan-change/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Request failed"); if (path === "preview") setPreview(body); else { setMessage("Plan change recorded."); setTimeout(() => window.location.reload(), 500); } } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); } finally { setBusy(false); } }
  return <Modal title="Review plan change" onClose={onClose}><div className="space-y-4">
    {!preview ? <><Field label="CRM plan"><Select value={form.crmSku} onChange={(e) => setForm({ ...form, crmSku: e.target.value })}><option value="crm_starter">Starter</option><option value="crm_growth">Growth</option></Select></Field>
      <Field label="Agentic AI"><Select value={form.aiSku} onChange={(e) => setForm({ ...form, aiSku: e.target.value })}><option value="">None</option><option value="agentic_business">Agentic Business</option><option value="agentic_scale">Agentic Scale</option></Select></Field>
      <Field label="Purchased seats"><Input type="number" min={1} value={form.purchasedSeats} onChange={(e) => setForm({ ...form, purchasedSeats: Number(e.target.value) })} /></Field>
      <Field label="Effective date and time"><Input type="datetime-local" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} /></Field>
      <Field label="Charge treatment"><Select value={form.chargeHandling} onChange={(e) => setForm({ ...form, chargeHandling: e.target.value })}><option value="at_renewal">At renewal</option><option value="prorate">Prorate</option><option value="waive">Waive adjustment</option></Select></Field>
      <Field label="Reason"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
      <Button className="w-full" disabled={busy || form.reason.trim().length < 3} onClick={() => submit("preview")}>{busy ? "Calculating…" : "Preview exact amounts"}</Button></> : <>
      <Summary label="Current monthly" value={formatUsd(preview.current.recurringMonthlyUsdCents)} /><Summary label="New monthly" value={formatUsd(preview.proposed.recurringMonthlyUsdCents)} /><Summary label="One-time adjustment" value={formatUsd(preview.oneTimeAdjustmentUsdCents)} /><Summary label="Effective" value={new Date(preview.effectiveAt).toLocaleString()} />
      {preview.consentRequired ? <Field label="Customer consent evidence reference"><Input value={form.agreementRef} onChange={(e) => setForm({ ...form, agreementRef: e.target.value })} placeholder="Signed amendment or approval reference" /></Field> : null}
      <p className="text-xs text-[var(--text-tertiary)]">No payment is charged and no invoice is marked paid by this action.</p>
      <div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setPreview(null)}>Back</Button><Button className="flex-1" disabled={busy || (preview.consentRequired && form.agreementRef.trim().length < 3)} onClick={() => submit("confirm")}>{busy ? "Recording…" : "Confirm amendment"}</Button></div>
    </>}{message ? <p role="status" className="text-sm text-[var(--warning)]">{message}</p> : null}
  </div></Modal>;
}

function GraceDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const start = new Date(); const end = new Date(start.getTime() + 7 * 86400000);
  const [form, setForm] = useState({ startsAt: toLocalInput(start.toISOString()), endsAt: toLocalInput(end.toISOString()), reason: "" }); const [review, setReview] = useState(false); const [message, setMessage] = useState("");
  async function confirm() { setMessage(""); const response = await fetch(`/api/admin/commercial/clients/${clientId}/grace`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), customerNotified: false }) }); const body = await response.json(); if (!response.ok) return setMessage(body.error ?? "Request failed"); window.location.reload(); }
  return <Modal title="Set grace period" onClose={onClose}><div className="space-y-4">{!review ? <><Field label="Starts"><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></Field><Field label="Ends (maximum 30 days)"><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></Field><Field label="Reason"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field><Button className="w-full" disabled={form.reason.trim().length < 3} onClick={() => setReview(true)}>Review grace period</Button></> : <><Summary label="Starts" value={new Date(form.startsAt).toLocaleString()} /><Summary label="Ends" value={new Date(form.endsAt).toLocaleString()} /><Summary label="Reason" value={form.reason} /><p className="text-xs text-[var(--text-tertiary)]">This extends billing access only. It does not mark invoices paid, change charges, add AI allowance, or bypass a security suspension.</p><div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setReview(false)}>Back</Button><Button className="flex-1" onClick={confirm}>Confirm grace</Button></div></>}{message ? <p role="status" className="text-sm text-[var(--warning)]">{message}</p> : null}</div></Modal>;
}

function EndGraceDialog({ clientId, grace, onClose }: { clientId: string; grace: NonNullable<Grace>; onClose: () => void }) { const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); async function confirm() { const response = await fetch(`/api/admin/commercial/clients/${clientId}/grace`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ graceId: grace.id, reason }) }); const body = await response.json(); if (!response.ok) return setMessage(body.error ?? "Request failed"); window.location.reload(); } return <Modal title="End grace period" onClose={onClose}><div className="space-y-4"><p className="text-sm text-[var(--text-secondary)]">Access will be re-evaluated immediately against overdue billing and security status.</p><Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Button variant="destructive" className="w-full" disabled={reason.trim().length < 3} onClick={confirm}>Confirm early termination</Button>{message ? <p role="status" className="text-sm text-[var(--warning)]">{message}</p> : null}</div></Modal>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { const closeRef = useRef<HTMLButtonElement>(null); useEffect(() => { closeRef.current?.focus(); const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler); }, [onClose]); return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="commercial-dialog-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-[var(--border)] bg-[var(--surface-modal)] p-4 shadow-[var(--shadow-modal)] sm:max-w-md sm:rounded-xl sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="commercial-dialog-title" className="text-base font-semibold text-[var(--text-primary)]">{title}</h2><Button ref={closeRef} size="icon-sm" variant="ghost" aria-label="Close dialog" onClick={onClose}>×</Button></div>{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>{children}</label>; }
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-2 text-sm"><span className="text-[var(--text-tertiary)]">{label}</span><span className="text-right font-medium text-[var(--text-primary)]">{value}</span></div>; }
function toLocalInput(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
