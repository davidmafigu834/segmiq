"use client";

import { useMemo, useState } from "react";
import { ReSection } from "@/components/real-estate/ui";
import { fieldsForKind, type IntakeKind } from "@/lib/real-estate/seller-intake/fields";

const fieldClass = "min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[14px] text-sales-text-primary";

export function SellerTemplateSetup({ clientId }: { clientId: string }) {
  const [kind, setKind] = useState<IntakeKind>("open");
  const [title, setTitle] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [clauses, setClauses] = useState("");
  const [months, setMonths] = useState("");
  const [continues, setContinues] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lines = useMemo(() => clauses.split("\n").map((line) => line.trim()).filter(Boolean), [clauses]);
  const fields = fieldsForKind(kind);

  async function approve() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/clients/${clientId}/seller-intake-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        title,
        organisationName,
        clauses: lines,
        exclusivityMinimumMonths: kind === "sole" && months ? Number(months) : null,
        exclusivityContinuesUntilVaried: kind === "sole" && continues,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 404) {
      setMessage("Seller forms are not enabled for this organisation.");
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "The template was not saved.");
      return;
    }
    setPreview(false);
    setMessage(`Version ${json.template?.version ?? ""} is approved. Agents can select it. An earlier prepared document keeps its own version.`);
  }

  return (
    <ReSection
      id="seller-template-setup"
      title="Mandate templates"
      description="Approve the organisation's open and sole wording. This is not a template builder. Paste the clauses the organisation already uses."
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-sales-text-secondary">
          No template is supplied by the platform. Fees, VAT and agency identity stay in the text you paste. Approving saves a new version and retires the previous approved version of that kind. It does not rewrite a document already prepared from an earlier version.
        </p>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-sales-text-primary">
          Mandate kind
          <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as IntakeKind)}>
            <option value="open">Open mandate</option>
            <option value="sole">Sole mandate</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-sales-text-primary">
          Template title
          <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-sales-text-primary">
          Organisation name shown on the prepared document
          <input className={fieldClass} value={organisationName} onChange={(event) => setOrganisationName(event.target.value)} maxLength={180} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-sales-text-primary">
          Clauses, one per line
          <textarea className={`${fieldClass} min-h-32 py-2`} value={clauses} onChange={(event) => setClauses(event.target.value)} />
        </label>
        {kind === "sole" ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[13px] font-medium text-sales-text-primary">
              Minimum months from signature, if this template states one
              <input className={fieldClass} inputMode="numeric" value={months} onChange={(event) => setMonths(event.target.value.replace(/[^\d]/g, "").slice(0, 2))} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-sales-text-primary">
              <input type="checkbox" checked={continues} onChange={(event) => setContinues(event.target.checked)} />
              Continues until the owner varies it in writing
            </label>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" onClick={() => setPreview(true)}>
            Preview
          </button>
          <button type="button" disabled={busy || title.trim().length < 3 || organisationName.trim().length < 2} className="min-h-11 rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface disabled:opacity-50" onClick={() => void approve()}>
            Approve version
          </button>
        </div>
        {error ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
        {message ? <p className="text-[13px] text-sales-text-secondary">{message}</p> : null}
        {preview ? (
          <div className="rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3">
            <p className="text-[13px] font-semibold text-sales-text-primary">Preview before approval. This is not a signed mandate.</p>
            <p className="mt-2 text-[13px] text-sales-text-secondary">{organisationName || "Organisation name missing"} · {title || "Untitled"} · {kind}</p>
            <p className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-sales-text-muted">Fields the seller completes</p>
            <ul className="mt-1 list-disc pl-5 text-[13px] text-sales-text-secondary">
              {fields.map((field) => <li key={field.key}>{field.label}</li>)}
            </ul>
            <p className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-sales-text-muted">Clauses</p>
            {lines.length === 0 ? <p className="text-[13px] text-sales-text-secondary">No clause text yet.</p> : (
              <ol className="mt-1 list-decimal pl-5 text-[13px] text-sales-text-secondary">
                {lines.map((line) => <li key={line}>{line}</li>)}
              </ol>
            )}
          </div>
        ) : null}
      </div>
    </ReSection>
  );
}
