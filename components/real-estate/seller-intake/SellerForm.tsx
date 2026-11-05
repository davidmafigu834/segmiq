"use client";

import { useEffect, useState } from "react";

type Field = {
  key: string;
  label: string;
  input: "text" | "textarea" | "date" | "choice" | "money";
  options?: string[];
  requiredToSubmit: boolean;
  restricted: boolean;
  value: string;
  locked: boolean;
  instruction: string | null;
};

type FormPayload = {
  title: string;
  kind: "open" | "sole";
  clauses: string[];
  exclusivityNote: string | null;
  fields: Field[];
  draftExists: boolean;
};

const fieldClass = "min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[16px] text-sales-text-primary";

export function SellerForm({ token }: { token: string }) {
  const [form, setForm] = useState<FormPayload | null>(null);
  const [version, setVersion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>("draft_link");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/public/seller-intakes/${encodeURIComponent(token)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "This link is not available.");
      return;
    }
    setForm(json.form);
    setVersion(json.version ?? 0);
    setStatus(json.status);
    const next: Record<string, string> = {};
    for (const field of json.form.fields as Field[]) next[field.key] = field.value ?? "";
    setAnswers(next);
    setError(null);
  }

  useEffect(() => {
    void load();
    // The token is the request secret. It is not written to the console.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function save(submit: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/public/seller-intakes/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, version: version || null, submit }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save.");
      return;
    }
    setVersion(json.version ?? version);
    setStatus(json.status);
    setNotice(submit ? "Submitted. The agent will review it before any records are updated." : "Saved on this browser. You can come back with this same link.");
    if (submit) await load();
  }

  if (error && !form) {
    return <main className="mx-auto max-w-lg px-4 py-8 text-[16px] text-sales-text-primary">{error}</main>;
  }
  if (!form) return <main className="mx-auto max-w-lg px-4 py-8 text-sales-text-secondary">Loading the form…</main>;
  if (status === "submitted" || status === "accepted") {
    return (
      <main className="mx-auto max-w-lg space-y-3 px-4 py-8">
        <h1 className="text-[22px] font-semibold text-sales-text-primary">Form received</h1>
        <p className="text-[16px] leading-6 text-sales-text-secondary">The agent has your answers. Nothing is signed by this form, and a listing is not created yet.</p>
      </main>
    );
  }
  const instructions = [...new Set(form.fields.map((field) => field.instruction).filter(Boolean))];
  return (
    <main className="mx-auto max-w-lg space-y-5 overflow-x-hidden px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-[22px] font-semibold text-sales-text-primary">{form.title}</h1>
        <p className="text-[15px] leading-6 text-sales-text-secondary">
          {form.kind === "sole" ? "Sole mandate details." : "Open mandate details."} Save as you go. Photographs, bedrooms and size are not required.
        </p>
      </header>
      {form.draftExists ? <p className="text-[15px] text-sales-warning-fg">A draft exists on another browser. Ask the agent for a resume link. This page does not show those answers.</p> : null}
      {instructions.map((instruction) => <p key={instruction} className="text-[15px] text-sales-text-primary">What to correct: {instruction}</p>)}
      {form.exclusivityNote ? <p className="text-[15px] leading-6 text-sales-text-secondary">{form.exclusivityNote}</p> : null}
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(true); }}>
        {form.fields.map((field) => (
          <label key={field.key} className="block space-y-1">
            <span className="block break-words text-[13px] font-semibold text-sales-text-primary">
              {field.label}{field.requiredToSubmit ? " (needed to submit)" : ""}
            </span>
            {field.locked ? <span className="block break-words text-[16px] text-sales-text-primary">{answers[field.key] || "—"}</span> : field.input === "textarea" ? (
              <textarea className={`${fieldClass} break-words`} rows={3} value={answers[field.key] ?? ""} onChange={(event) => setAnswers({ ...answers, [field.key]: event.target.value })} />
            ) : field.input === "choice" ? (
              <select className={fieldClass} value={answers[field.key] ?? ""} onChange={(event) => setAnswers({ ...answers, [field.key]: event.target.value })}>
                <option value="">Choose</option>
                {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <input className={fieldClass} type={field.input === "date" ? "date" : "text"} inputMode={field.input === "money" ? "decimal" : undefined} value={answers[field.key] ?? ""} onChange={(event) => setAnswers({ ...answers, [field.key]: event.target.value })} />
            )}
          </label>
        ))}
        {form.clauses.length ? (
          <section className="space-y-2">
            <h2 className="text-[16px] font-semibold">Terms from the selected template</h2>
            {form.clauses.map((clause, index) => <p key={`${index}-${clause.slice(0, 24)}`} className="whitespace-pre-wrap break-words text-[15px] leading-6 text-sales-text-secondary">{clause}</p>)}
          </section>
        ) : null}
        {error ? <p className="text-[14px] text-sales-danger">{error}</p> : null}
        {notice ? <p className="text-[14px] text-sales-text-secondary">{notice}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void save(false)} className="min-h-11 rounded-[8px] border border-sales-border px-4 text-[15px] font-semibold">Save</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-[8px] bg-sales-text-primary px-4 text-[15px] font-semibold text-sales-surface">{busy ? "Saving…" : "Submit"}</button>
        </div>
      </form>
    </main>
  );
}
