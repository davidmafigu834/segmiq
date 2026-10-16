"use client";

import { useState, type FormEvent } from "react";
import { uploadCompanyDocument } from "@/lib/documents/client-upload";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { ReSheet } from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass, formatWhen, mandateTypeLabel } from "./acquisition-ui";

export type MandateRow = Record<string, unknown> & {
  id: string;
  status: string;
  displayStatus?: string;
};

async function postMandate(clientId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/clients/${clientId}/mandates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json };
}

/** Uploads a signed document as evidence. Returns its document id. */
export async function uploadEvidence(clientId: string, file: File): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  const result = await uploadCompanyDocument(clientId, file, { forceUpload: true });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, documentId: result.documentId };
}

type Mode = "renew" | "revoke" | "reject" | "history" | "approve" | null;

export function MandateActions({
  clientId,
  mandate,
  canReview,
  onChanged,
}: {
  clientId: string;
  mandate: MandateRow;
  canReview: boolean;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ versions: Array<Record<string, unknown>>; events: Array<Record<string, unknown>> } | null>(null);
  const status = String(mandate.displayStatus ?? mandate.status);
  const rawStatus = String(mandate.status);
  const renewable = (rawStatus === "approved" || rawStatus === "expired") && !mandate.superseded_by_id && !mandate.revoked_at;
  const revocable = canReview && (rawStatus === "approved" || rawStatus === "submitted") && !mandate.revoked_at;
  const reviewable = canReview && (rawStatus === "submitted" || rawStatus === "awaiting_evidence");

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const { ok, json } = await postMandate(clientId, body);
    setBusy(false);
    if (!ok) {
      setError((json.error as string) ?? "Could not save the change.");
      return false;
    }
    setError(null);
    setMode(null);
    onChanged();
    return true;
  }

  async function loadHistory() {
    setMode(mode === "history" ? null : "history");
    if (history) return;
    const res = await fetch(`/api/clients/${clientId}/mandates?mandateId=${mandate.id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "Could not load the history.");
    else setHistory(json);
  }

  async function renew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("evidence");
    let documentId: string | null = null;
    setBusy(true);
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadEvidence(clientId, file);
      if (!uploaded.ok) {
        setBusy(false);
        setError(uploaded.error);
        return;
      }
      documentId = uploaded.documentId;
    }
    setBusy(false);
    await run({
      action: "renew",
      mandateId: mandate.id,
      startDate: String(form.get("startDate") ?? ""),
      expiryDate: String(form.get("expiryDate") ?? ""),
      mandateType: form.get("mandateType") || null,
      terms: String(form.get("terms") ?? "").trim() || null,
      documentId,
      submit: form.get("submit") === "on",
    });
  }

  const quiet = "re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover disabled:opacity-50";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {reviewable ? (
          <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} disabled={busy} onClick={() => setMode("approve")}>
            Approve mandate
          </button>
        ) : null}
        {reviewable ? (
          <button type="button" className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] border border-sales-danger px-3 text-[13px] font-semibold text-sales-danger-fg disabled:opacity-50" disabled={busy} onClick={() => setMode(mode === "reject" ? null : "reject")}>
            Reject
          </button>
        ) : null}
        {renewable ? <button type="button" className={quiet} onClick={() => setMode(mode === "renew" ? null : "renew")}>Renew</button> : null}
        {revocable ? (
          <button type="button" className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] px-3 text-[13px] font-semibold text-sales-danger-fg" onClick={() => setMode("revoke")}>
            Revoke
          </button>
        ) : null}
        <button type="button" className={quiet} onClick={() => void loadHistory()}>History</button>
      </div>
      {error ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {status === "expiring_soon" && renewable ? (
        <p className="text-[13px] text-sales-warning-fg">Expires soon. Start the renewal so it can be reviewed in time.</p>
      ) : null}

      {mode === "approve" ? (
        <div className="rounded-[var(--re-radius-control,8px)] border border-sales-border bg-sales-surface-subtle p-3">
          <p className="text-[14px] font-semibold text-sales-text-primary">Approve this mandate?</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            {mandateTypeLabel(mandate.mandate_type as string)}
            {mandate.expiry_date ? ` · expires ${String(mandate.expiry_date)}` : ""}
            {` · evidence ${String(mandate.evidence_status ?? "not provided").replaceAll("_", " ")}. Uploaded evidence is not the same as a legal check.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} onClick={() => void run({ action: "review", mandateId: mandate.id, decision: "approved" })}>
              {busy ? "Saving…" : "Confirm approval"}
            </button>
            <button type="button" className={quiet} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      ) : null}

      {mode === "reject" ? (
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const note = String(new FormData(event.currentTarget).get("note") ?? "");
            void run({ action: "review", mandateId: mandate.id, decision: "rejected", note });
          }}
        >
          <label>
            <span className={acqLabelClass}>What needs to change?</span>
            <input name="note" required minLength={3} className={acqFieldClass} />
          </label>
          <button type="submit" disabled={busy} className="re-focus min-h-11 self-end rounded-[var(--re-radius-control,8px)] border border-sales-danger px-3 text-[13px] font-semibold text-sales-danger-fg">
            Reject mandate
          </button>
        </form>
      ) : null}

      {mode === "renew" ? (
        <form className="space-y-3 rounded-[var(--re-radius-card,12px)] border border-sales-border p-3" onSubmit={(event) => void renew(event)}>
          <p className="text-[13px] text-sales-text-secondary">
            A renewal is a new mandate linked to this one. It needs dates, and a manager&apos;s approval if you submit it. Nothing renews by itself.
            {mandate.expiry_date ? ` The current expiry is ${String(mandate.expiry_date)}.` : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-[12px] font-medium text-sales-text-secondary">Start
              <input name="startDate" type="date" required className={`${acqFieldClass} mt-1`} defaultValue={String(mandate.expiry_date ?? "")} />
            </label>
            <label className="text-[12px] font-medium text-sales-text-secondary">Expiry
              <input name="expiryDate" type="date" required className={`${acqFieldClass} mt-1`} />
            </label>
            <label className="text-[12px] font-medium text-sales-text-secondary">Type
              <select name="mandateType" className={`${acqFieldClass} mt-1`} defaultValue={String(mandate.mandate_type ?? "sole")}>
                <option value="sole">Sole</option>
                <option value="joint">Joint</option>
                <option value="open">Open</option>
              </select>
            </label>
          </div>
          <textarea name="terms" rows={2} className={acqFieldClass} placeholder="Changed terms, if any" />
          <label className="block text-[12px] font-medium text-sales-text-secondary">
            Signed renewal
            <input name="evidence" type="file" accept=".pdf,image/*" className="mt-1 block w-full text-[14px]" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-[13px] text-sales-text-secondary">
            <input name="submit" type="checkbox" className="size-4" /> Submit for manager review
          </label>
          <button type="submit" disabled={busy} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>
            {busy ? "Saving…" : "Save renewal"}
          </button>
        </form>
      ) : null}

      {mode === "revoke" ? (
        <ReSheet
          title="Revoke mandate"
          description="When the revocation takes effect, the listing returns to approval unless another valid mandate covers it."
          placement="bottom"
          onClose={() => setMode(null)}
          footer={
            <button type="submit" form="revoke-mandate" disabled={busy} className="re-focus min-h-11 rounded-[var(--re-radius-control,8px)] border border-sales-danger px-4 text-[14px] font-semibold text-sales-danger-fg">
              {busy ? "Saving…" : "Revoke this mandate"}
            </button>
          }
        >
          <form
            id="revoke-mandate"
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run({
                action: "revoke",
                mandateId: mandate.id,
                reason: String(form.get("reason") ?? ""),
                effectiveDate: String(form.get("effectiveDate") ?? ""),
                reference: String(form.get("reference") ?? "").trim() || null,
              });
            }}
          >
            <label className="text-[12px] font-medium text-sales-text-secondary">Effective date
              <input name="effectiveDate" type="date" required className={`${acqFieldClass} mt-1`} defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="text-[12px] font-medium text-sales-text-secondary">Reference
              <input name="reference" className={`${acqFieldClass} mt-1`} placeholder="Letter or email reference" />
            </label>
            <label className="text-[12px] font-medium text-sales-text-secondary">Reason
              <input name="reason" required minLength={3} className={`${acqFieldClass} mt-1`} />
            </label>
          </form>
        </ReSheet>
      ) : null}

      {mode === "history" && history ? (
        <div className="space-y-3 rounded-[var(--re-radius-control,8px)] border border-sales-border p-3 text-[13px]">
          <div>
            <p className="font-semibold text-sales-text-primary">Versions</p>
            <ol className="mt-1 space-y-1">
              {history.versions.map((version) => (
                <li key={String(version.id)} className={version.id === mandate.id ? "font-semibold" : "text-sales-text-secondary"}>
                  {String(version.status).replaceAll("_", " ")} · {String(version.start_date ?? "no start")} to {String(version.expiry_date ?? "no expiry")}
                  {version.revocation_effective_date ? ` · revoked from ${String(version.revocation_effective_date)}` : ""}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="font-semibold text-sales-text-primary">Events</p>
            <ul className="mt-1 space-y-1 text-sales-text-secondary">
              {history.events.map((item) => (
                <li key={String(item.id)}>
                  {String(item.event_type).replaceAll("_", " ")}
                  {item.note ? ` · ${String(item.note)}` : ""} · {formatWhen(String(item.created_at))}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
