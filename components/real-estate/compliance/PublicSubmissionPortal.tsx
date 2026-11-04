"use client";

import { useState, type FormEvent } from "react";

type Requirement = { requirement_key: string; label: string; evidence_kind: string; field_keys?: string[]; state: string };

const SAMPLE_REQUIREMENTS: Record<"individual" | "company", Requirement[]> = {
  individual: [
    { requirement_key: "legal_name", label: "Full legal name", evidence_kind: "field", field_keys: ["full_legal_name"], state: "awaiting_information" },
    { requirement_key: "identity_document", label: "Identity document", evidence_kind: "document", field_keys: [], state: "awaiting_information" },
  ],
  company: [
    { requirement_key: "registered_name", label: "Registered legal name", evidence_kind: "field", field_keys: ["registered_name"], state: "awaiting_information" },
    { requirement_key: "beneficial_owners", label: "Beneficial owners", evidence_kind: "field", field_keys: ["beneficial_owner_name"], state: "awaiting_information" },
    { requirement_key: "registration_document", label: "Company registration", evidence_kind: "document", field_keys: [], state: "awaiting_information" },
  ],
};

export function PublicSubmissionPortal({ token, sample = null }: { token: string; sample?: "individual" | "company" | null }) {
  const [step, setStep] = useState<"intro" | "code" | "form" | "done" | "error">("intro");
  const [agency, setAgency] = useState(sample ? "Sample Agency" : "Your agency");
  const [purpose, setPurpose] = useState(sample === "company" ? "Company buyer verification" : sample ? "Individual buyer verification" : "Provide the requested information");
  const [notice, setNotice] = useState(sample ? "Sample request only. Nothing on this page is stored, and it is not a live customer invitation." : "The agency requested this information for customer due diligence.");
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [formStage, setFormStage] = useState<"details" | "documents" | "review">("details");

  async function post(body: FormData | Record<string, unknown>) {
    const res = await fetch("/api/public/compliance-invitations", {
      method: "POST",
      credentials: "include",
      headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(json.error ?? "The request could not be completed."));
    return json;
  }

  async function start() {
    setBusy(true);
    setMessage(null);
    try {
      if (sample) {
        setAgency("Sample Agency");
        setPurpose(sample === "company" ? "Company buyer verification" : "Individual buyer verification");
        setNotice("Sample request only. Nothing on this page is stored, and it is not a live customer invitation.");
        setRequirements(SAMPLE_REQUIREMENTS[sample]);
        setStep("form");
        return;
      }
      const preview = await post({ token, action: "preview" });
      setAgency(String(preview.agencyName ?? agency));
      setPurpose(String(preview.purpose ?? purpose));
      setNotice(String(preview.notice ?? notice));
      if (preview.expired) {
        setStep("error");
        setMessage("This request has expired. Ask the agency for a new link.");
        return;
      }
      await post({ token, action: "send_code" });
      setStep("code");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The secure form is not available.");
      if (String(message).includes("verification code") || (error instanceof Error && error.message.includes("verification code"))) setStep("error");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setFieldError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const result = await post({ token, action: "verify", code });
      setRequirements((result.requirements as Requirement[]) ?? []);
      setStep("form");
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "That code was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (sample) {
      setStatusNote("Sample only. Nothing was stored. A live request keeps the draft on the same verified link.");
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("action", "save");
      form.set("fields", JSON.stringify(fields));
      for (const [key, file] of Object.entries(files)) {
        if (file) form.set(`file:${key}`, file);
      }
      await post(form);
      setStatusNote("Saved. Return with the same link and a new verification code while the request is open.");
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "The draft was not saved.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const missing = requirements.filter((item) => item.evidence_kind === "field" && (item.field_keys ?? []).some((key) => !fields[key]?.trim()));
    if (missing.length) {
      setFieldError(`Complete ${missing[0]?.label ?? "the required fields"} before submitting.`);
      return;
    }
    if (formStage !== "review") {
      const hasDocuments = requirements.some((item) => item.evidence_kind === "document");
      setFormStage(formStage === "details" && hasDocuments ? "documents" : "review");
      setFieldError(null);
      return;
    }
    if (sample) {
      setMessage(null);
      setStep("done");
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("action", "submit");
      form.set("fields", JSON.stringify(fields));
      for (const [key, file] of Object.entries(files)) {
        if (file) form.set(`file:${key}`, file);
      }
      await post(form);
      setStep("done");
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "The submission was not saved.");
    } finally {
      setBusy(false);
    }
  }

  const partyItems = requirements.filter((item) => item.evidence_kind === "party");
  const fieldItems = requirements.filter((item) => item.evidence_kind !== "document" && item.evidence_kind !== "party");
  const documentItems = requirements.filter((item) => item.evidence_kind === "document");
  const stages = documentItems.length ? (["details", "documents", "review"] as const) : (["details", "review"] as const);
  const stageLabel: Record<typeof formStage, string> = { details: "Your details", documents: "Documents", review: "Review" };

  return (
    <main className="sales-dashboard-premium mx-auto min-h-screen max-w-lg bg-sales-bg px-4 py-8 text-sales-text-primary">
      <p className="text-[13px] text-sales-text-muted">{agency}</p>
      <h1 className="mt-1 font-display text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">{purpose}</h1>
      <p className="mt-2 text-[14px] leading-6 text-sales-text-secondary">{notice}</p>
      {message ? <p className="mt-4 text-[14px] text-sales-danger-fg" role="alert">{message}</p> : null}
      {statusNote ? <p className="mt-4 text-[14px] text-sales-text-secondary" role="status">{statusNote}</p> : null}

      {step === "intro" ? (
        <div className="mt-6">
          <ol className="space-y-2 text-[14px] text-sales-text-secondary">
            <li>1. Confirm this request belongs to you.</li>
            <li>2. Enter the details the agency asked for.</li>
            <li>3. Add the documents, then review before sending.</li>
          </ol>
          <p className="mt-4 text-[13px] leading-5 text-sales-text-muted">The agency will review what you send. Submitting this form does not verify your identity. Use the link only for this request, and do not forward it.</p>
          <button type="button" className="re-focus mt-6 min-h-11 rounded-[8px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text" disabled={busy} onClick={() => void start()}>
            {busy ? "Checking the request…" : "Continue"}
          </button>
        </div>
      ) : null}

      {step === "code" ? (
        <form className="mt-6 space-y-3" onSubmit={(event) => void verify(event)}>
          <label className="block text-[13px] font-medium" htmlFor="otp">Email verification code</label>
          <input id="otp" inputMode="numeric" autoComplete="one-time-code" aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? "otp-error" : "otp-help"} className="min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[16px] tracking-[0.2em]" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          <p id="otp-help" className="text-[13px] text-sales-text-muted">Enter the 6-digit code from the email. A code confirms you can open this link. It does not verify your identity.</p>
          {fieldError ? <p id="otp-error" className="text-[13px] text-sales-danger-fg" role="alert">{fieldError}</p> : null}
          <button type="submit" className="re-focus min-h-11 rounded-[8px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text" disabled={busy}>{busy ? "Checking…" : "Open the form"}</button>
        </form>
      ) : null}

      {step === "form" ? (
        <form className="mt-6" onSubmit={(event) => void submit(event)}>
          <p className="text-[12px] text-sales-text-muted">
            {stages.map((stage, index) => (
              <span key={stage}>{index > 0 ? " · " : ""}<span className={formStage === stage ? "font-semibold text-sales-text-primary" : ""}>{stageLabel[stage]}</span></span>
            ))}
          </p>
          {requirements.length === 0 ? <p className="mt-4 text-[14px]">Nothing on this request needs a change.</p> : null}
          {formStage === "details" ? (
            <div className="mt-4 space-y-4">
              {fieldItems.map((item) => (
                <fieldset key={item.requirement_key} className="space-y-3">
                  <legend className="text-[15px] font-semibold">{item.label}</legend>
                  {(item.field_keys ?? []).map((key) => (
                    <label key={key} className="block text-[13px] font-medium">
                      {key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                      <input className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-3 font-normal" value={fields[key] ?? ""} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} />
                    </label>
                  ))}
                </fieldset>
              ))}
              {partyItems.map((item) => (
                <label key={item.requirement_key} className="block text-[13px] font-medium">
                  {item.label}
                  <textarea className="mt-1 min-h-24 w-full rounded-[8px] border border-sales-border bg-sales-surface p-3 font-normal" value={fields[item.requirement_key] ?? ""} placeholder="One name on each line" onChange={(event) => setFields((current) => ({ ...current, [item.requirement_key]: event.target.value }))} />
                </label>
              ))}
            </div>
          ) : null}
          {formStage === "documents" ? (
            <div className="mt-4 space-y-5">
              <p className="text-[13px] leading-5 text-sales-text-secondary">Use a clear photo or PDF. The file stays on this device until you submit and the agency confirms it.</p>
              {documentItems.map((item) => (
                <div key={item.requirement_key}>
                  <p className="text-[15px] font-semibold">{item.label}</p>
                  <label className="mt-2 block text-[13px] font-medium">
                    Choose a file
                    <input className="mt-1 block w-full text-[13px] font-normal" type="file" accept="application/pdf,image/*" onChange={(event) => setFiles((current) => ({ ...current, [item.requirement_key]: event.target.files?.[0] ?? null }))} />
                  </label>
                  {files[item.requirement_key] ? (
                    <p className="mt-2 flex items-center justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate">{files[item.requirement_key]?.name} · selected, not yet sent</span>
                      <button type="button" className="re-focus min-h-11 shrink-0 font-semibold" onClick={() => setFiles((current) => ({ ...current, [item.requirement_key]: null }))}>Remove</button>
                    </p>
                  ) : <p className="mt-2 text-[13px] text-sales-text-muted">No file selected.</p>}
                </div>
              ))}
            </div>
          ) : null}
          {formStage === "review" ? (
            <div className="mt-4">
              <p className="text-[13px] text-sales-text-secondary">Check this before sending. The agency will contact you if something else is required.</p>
              <ul className="mt-3 divide-y divide-sales-border text-[14px]">
                {requirements.map((item) => (
                  <li key={item.requirement_key} className="py-2">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-[13px] text-sales-text-muted">
                      {item.evidence_kind === "document"
                        ? (files[item.requirement_key]?.name ?? "No file selected")
                        : item.evidence_kind === "party"
                          ? (fields[item.requirement_key]?.trim() || "No names entered")
                          : (item.field_keys ?? []).map((key) => fields[key]?.trim() || "Not entered").join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {fieldError ? <p className="mt-3 text-[13px] text-sales-danger-fg" role="alert">{fieldError}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {formStage !== "details" ? (
              <button type="button" className="re-focus min-h-11 rounded-[8px] border border-sales-border px-4 text-[14px] font-semibold" onClick={() => setFormStage(formStage === "review" && documentItems.length ? "documents" : "details")}>Back</button>
            ) : null}
            <button type="button" className="re-focus min-h-11 rounded-[8px] border border-sales-border px-4 text-[14px] font-semibold" disabled={busy} onClick={() => void saveDraft()}>{busy ? "Saving…" : "Save and resume"}</button>
            <button type="submit" className="re-focus min-h-11 rounded-[8px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text" disabled={busy}>{busy ? "Submitting…" : formStage === "review" ? "Submit" : "Continue"}</button>
          </div>
        </form>
      ) : null}

      {step === "done" ? (
        <div className="mt-6" role="status">
          <p className="font-display text-[1.5rem] font-semibold leading-tight">Your information has been submitted successfully.</p>
          <p className="mt-2 text-[14px] leading-6 text-sales-text-secondary">The agency will review the information and contact you if anything else is required.</p>
          {sample ? <p className="mt-2 text-[13px] text-sales-text-muted">Sample only. Nothing was stored and nothing was marked verified.</p> : null}
        </div>
      ) : null}

      {step === "error" ? (
        <p className="mt-6 text-[14px] leading-6">This secure document request has expired or is no longer available. Ask the agency to send a new link.</p>
      ) : null}
    </main>
  );
}
