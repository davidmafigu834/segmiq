"use client";

import { useState, type FormEvent } from "react";
import { uploadCompanyDocument } from "@/lib/documents/client-upload";

export type MandateRow = Record<string, unknown> & {
  id: string;
  status: string;
  displayStatus?: string;
};

const fieldClass = "min-h-11 w-full rounded-md border border-sales-border bg-sales-surface px-3 text-sm";
const linkButton = "min-h-9 text-xs font-semibold underline disabled:opacity-50";

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

type Mode = "renew" | "revoke" | "reject" | "history" | null;

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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {reviewable ? (
          <>
            <button type="button" className={linkButton} disabled={busy} onClick={() => void run({ action: "review", mandateId: mandate.id, decision: "approved" })}>
              Approve
            </button>
            <button type="button" className={linkButton} disabled={busy} onClick={() => setMode(mode === "reject" ? null : "reject")}>Reject</button>
          </>
        ) : null}
        {renewable ? <button type="button" className={linkButton} onClick={() => setMode(mode === "renew" ? null : "renew")}>Renew</button> : null}
        {revocable ? <button type="button" className={`${linkButton} text-red-700`} onClick={() => setMode(mode === "revoke" ? null : "revoke")}>Revoke</button> : null}
        <button type="button" className={linkButton} onClick={() => void loadHistory()}>History</button>
      </div>
      {error ? <p className="text-xs text-red-600" role="alert">{error}</p> : null}

      {mode === "reject" ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const note = String(new FormData(event.currentTarget).get("note") ?? "");
            void run({ action: "review", mandateId: mandate.id, decision: "rejected", note });
          }}
        >
          <input name="note" required minLength={3} className={fieldClass} placeholder="What needs to change?" />
          <button type="submit" disabled={busy} className="min-h-11 rounded-md border border-sales-border px-3 text-sm">Reject</button>
        </form>
      ) : null}

      {mode === "renew" ? (
        <form className="space-y-2 rounded-md border border-sales-border p-3" onSubmit={(event) => void renew(event)}>
          <p className="text-xs text-sales-text-secondary">A renewal is a new mandate. It needs the signed document and a manager's approval. Nothing renews automatically.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Start<input name="startDate" type="date" required className={`${fieldClass} mt-1`} defaultValue={String(mandate.expiry_date ?? "")} /></label>
            <label className="text-xs">Expiry<input name="expiryDate" type="date" required className={`${fieldClass} mt-1`} /></label>
            <label className="text-xs">
              Type
              <select name="mandateType" className={`${fieldClass} mt-1`} defaultValue={String(mandate.mandate_type ?? "sole")}>
                <option value="sole">Sole</option>
                <option value="joint">Joint</option>
                <option value="open">Open</option>
              </select>
            </label>
          </div>
          <textarea name="terms" rows={2} className={fieldClass} placeholder="Changed terms (optional)" />
          <label className="block text-xs">
            Signed renewal
            <input name="evidence" type="file" accept=".pdf,image/*" className="mt-1 block text-sm" />
          </label>
          <label className="flex items-center gap-2 text-xs"><input name="submit" type="checkbox" /> Submit for manager review</label>
          <button type="submit" disabled={busy} className="min-h-11 rounded-md bg-sales-text-primary px-3 text-sm font-semibold text-white">Save renewal</button>
        </form>
      ) : null}

      {mode === "revoke" ? (
        <form
          className="space-y-2 rounded-md border border-red-200 p-3"
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
          <p className="text-xs text-sales-text-secondary">
            When the revocation takes effect, the listing returns to approval unless another valid mandate covers it.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">Effective date<input name="effectiveDate" type="date" required className={`${fieldClass} mt-1`} defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="text-xs">Reference<input name="reference" className={`${fieldClass} mt-1`} placeholder="Letter or email reference" /></label>
          </div>
          <input name="reason" required minLength={3} className={fieldClass} placeholder="Reason for revocation" />
          <button type="submit" disabled={busy} className="min-h-11 rounded-md border border-red-300 px-3 text-sm font-semibold text-red-700">Revoke mandate</button>
        </form>
      ) : null}

      {mode === "history" && history ? (
        <div className="space-y-2 rounded-md border border-sales-border p-3 text-xs">
          <p className="font-semibold">Versions</p>
          <ol className="space-y-1">
            {history.versions.map((version) => (
              <li key={String(version.id)} className={version.id === mandate.id ? "font-semibold" : ""}>
                {String(version.status).replaceAll("_", " ")} · {String(version.start_date ?? "no start")} to {String(version.expiry_date ?? "no expiry")}
                {version.revocation_effective_date ? ` · revoked from ${String(version.revocation_effective_date)}` : ""}
              </li>
            ))}
          </ol>
          <p className="font-semibold">Events</p>
          <ul className="space-y-1 text-sales-text-secondary">
            {history.events.map((item) => (
              <li key={String(item.id)}>
                {String(item.event_type).replaceAll("_", " ")}
                {item.note ? ` · ${String(item.note)}` : ""} · {new Date(String(item.created_at)).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {status === "expiring_soon" && renewable ? <p className="text-xs text-amber-800">Expires soon. Start the renewal so it can be reviewed in time.</p> : null}
    </div>
  );
}
