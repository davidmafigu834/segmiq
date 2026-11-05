"use client";

import React, { useId, useState } from "react";
import {
  PEP_EXPLANATION,
  clientTermsCopy,
  fieldCopy,
  fieldsInSection,
  sectionNavLabel,
  formatDisplayDate,
  isCompany,
  sectionCopy,
  sectionForKey,
  suggestPriceWords,
  visibleSections,
  type ClientField,
  type SectionId,
} from "@/lib/real-estate/seller-intake/client-form";

export type SellerFormModel = {
  title: string;
  kind: "open" | "sole";
  clauses: string[];
  exclusivityNote: string | null;
  agencyName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  phone: string | null;
  fields: ClientField[];
  draftExists: boolean;
};

const CSS = `
.smq{--smq-paper:#f6f1e8;--smq-card:#fffdf8;--smq-ink:#2a241c;--smq-muted:#5e564c;--smq-line:#e4d8c8;--smq-accent:#8c4a32;--smq-accent-soft:#f3e4da;--smq-danger:#8f2d2d;--smq-ok:#2f5d45;color:var(--smq-ink);background:radial-gradient(1200px 480px at 10% -10%, #f3e7d6, transparent 55%), var(--smq-paper);font-family:var(--font-dm-sans), "Segoe UI", sans-serif;min-height:100dvh;overflow-x:clip}
.smq *{box-sizing:border-box}
.smq h1,.smq h2,.smq h3{font-family:var(--font-instrument-serif), Georgia, serif;font-style:normal;font-weight:400;letter-spacing:-0.02em;overflow-wrap:anywhere}
.smq-shell{width:min(1040px, calc(100% - 32px));margin:0 auto;padding:28px 0 48px;display:grid;grid-template-columns:minmax(0,240px) minmax(0,640px);gap:28px;align-items:start}
.smq-aside{position:sticky;top:20px;display:flex;flex-direction:column;gap:16px}
.smq-brand{display:flex;gap:12px;align-items:center;min-width:0}
.smq-brand img{width:48px;height:48px;object-fit:contain;border-radius:12px;background:var(--smq-card);border:1px solid var(--smq-line)}
.smq-mark{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--smq-accent-soft);color:var(--smq-accent);flex:none}
.smq-kicker{margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--smq-muted)}
.smq-agency{margin:2px 0 0;font-size:18px;line-height:1.2}
.smq-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.smq-steps button{position:relative;width:100%;text-align:left;min-height:44px;border:0;background:transparent;color:var(--smq-muted);border-radius:10px;padding:8px 10px;font:inherit;cursor:pointer}
.smq-step-short{display:none}
.smq-steps button[aria-current="step"]{background:var(--smq-card);color:var(--smq-ink);box-shadow:inset 3px 0 0 var(--smq-accent)}
.smq-card{background:var(--smq-card);border:1px solid var(--smq-line);border-radius:22px;padding:28px 28px 24px;box-shadow:0 18px 40px rgba(72,48,28,.06)}
.smq-type{display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:0 10px;border-radius:999px;background:var(--smq-accent-soft);color:var(--smq-accent);font-size:13px;font-weight:650}
.smq h1{font-size:clamp(32px, 4vw, 44px);line-height:1.05;margin:14px 0 10px}
.smq h2{font-size:28px;line-height:1.15;margin:0 0 8px}
.smq-sub{font-size:22px;margin:26px 0 0}
.smq-lead,.smq-help,.smq p{font-size:16px;line-height:1.55}
.smq-lead{max-width:62ch;color:var(--smq-muted);margin:0 0 8px}
.smq-support{color:var(--smq-ink);margin:0}
.smq-note{margin:14px 0 0;padding:12px 14px;border-radius:12px;background:#f8efe4;color:var(--smq-ink)}
.smq-alert{margin:14px 0 0;padding:12px 14px;border-radius:12px;background:#f8e8e4;color:var(--smq-danger)}
.smq-field{display:flex;flex-direction:column;gap:6px;margin-top:18px}
.smq-field span{font-size:15px;font-weight:650}
.smq-req{color:var(--smq-accent)}
.smq-help{margin:0;color:var(--smq-muted);font-size:14px}
.smq input,.smq select,.smq textarea{width:100%;max-width:100%;min-height:48px;border:1px solid var(--smq-line);border-radius:12px;background:#fff;color:var(--smq-ink);padding:10px 12px;font:inherit;font-size:16px}
.smq textarea{min-height:96px;resize:vertical}
.smq input:focus,.smq select:focus,.smq textarea:focus,.smq button:focus-visible{outline:2px solid var(--smq-accent);outline-offset:2px}
.smq-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.smq-cards button{min-height:84px;border-radius:16px;border:1px solid var(--smq-line);background:#fff;text-align:left;padding:14px;font:inherit;cursor:pointer}
.smq-cards button[aria-checked="true"]{border:2px solid var(--smq-accent);background:var(--smq-accent-soft)}
.smq-cards strong{display:block;font-size:16px}
.smq-cards small{display:block;margin-top:4px;color:var(--smq-muted)}
.smq-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
.smq-actions button{min-height:48px;border-radius:12px;padding:0 16px;font:inherit;font-weight:650;cursor:pointer}
.smq-ghost{background:#fff;border:1px solid var(--smq-line);color:var(--smq-ink)}
.smq-solid{background:var(--smq-ink);color:#fffdf8;border:0}
.smq-text{background:transparent;border:0;color:var(--smq-accent);padding:0;min-height:44px;font:inherit;font-weight:650;cursor:pointer}
.smq-review{margin-top:18px;padding-top:8px;border-top:1px solid var(--smq-line)}
.smq-review h3{margin:16px 0 6px;font-size:22px}
.smq-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #f0e6da}
.smq-row b{font-weight:650}
.smq a{color:var(--smq-accent);font-weight:650}
.smq-foot{margin-top:28px;color:var(--smq-muted);font-size:13px}
.smq-live{min-height:1.2em;margin:12px 0 0;color:var(--smq-ok)}
@media (max-width:760px){
  .smq-shell{grid-template-columns:minmax(0,1fr);width:min(100% - 28px, 640px);padding-top:18px}
  .smq-aside{position:static}
  .smq-steps{flex-direction:row;flex-wrap:wrap}
  .smq-steps button{width:44px;min-height:44px;padding:0;text-align:center}
  .smq-step-full{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .smq-step-short{display:inline}
  .smq-card{padding:20px 16px 18px;border-radius:18px}
  .smq-cards{grid-template-columns:1fr}
  .smq h1{font-size:34px}
}
`;

function Mark() {
  return (
    <svg className="smq-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M10 22 L24 12 L38 22 V36 H10Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 36 V27 H27 V36" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function SellerMandateStatus({ agencyName, kind, message, detail }: { agencyName?: string; kind?: "open" | "sole"; message: string; detail?: string }) {
  return (
    <div className="smq">
      <style>{CSS}</style>
      <main className="smq-shell">
        <section className="smq-card">
          {kind ? <span className="smq-type">{kind === "sole" ? "Sole mandate" : "Open mandate"}</span> : null}
          <h1>{message}</h1>
          {detail ? <p className="smq-lead">{detail}</p> : null}
          {agencyName ? <p className="smq-support">Sending this form does not sign the mandate, approve it, verify evidence, or publish a listing.</p> : null}
        </section>
      </main>
    </div>
  );
}

export function SellerMandateExperience({
  form,
  answers,
  step,
  saveState,
  error,
  fieldErrors,
  onAnswer,
  onStep,
  onBack,
  onSave,
  onContinue,
  onSubmit,
}: {
  form: SellerFormModel;
  answers: Record<string, string>;
  step: number;
  saveState: "idle" | "saving" | "saved" | "error";
  error: string | null;
  fieldErrors: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
  onStep: (index: number) => void;
  onBack: () => void;
  onSave: () => void;
  onContinue: () => void;
  onSubmit: () => void;
}) {
  const [pepOpen, setPepOpen] = useState(false);
  const baseId = useId();
  const sections = visibleSections(form.kind, answers, form.fields);
  const section = sections[Math.min(step, sections.length - 1)] ?? "ownership";
  const copy = sectionCopy(section, answers);
  const visible = fieldsInSection(section, form.fields, answers);
  const terms = clientTermsCopy(form.exclusivityNote);
  const companyKept = !isCompany(answers) && form.fields.some((field) => field.key === "companyName" && answers.companyName);
  const mandateLabel = form.kind === "sole" ? "Sole mandate" : "Open mandate";

  return (
    <div className="smq">
      <style>{CSS}</style>
      <div className="smq-shell">
        <aside className="smq-aside">
          <div className="smq-brand">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- agency logos are arbitrary https URLs
              <img src={form.logoUrl} alt="" />
            ) : <Mark />}
            <div>
              <p className="smq-kicker">Selling mandate</p>
              <p className="smq-agency">{form.agencyName}</p>
            </div>
          </div>
          <ol className="smq-steps" aria-label="Form progress">
            {sections.map((id, index) => (
              <li key={id}>
                <button type="button" aria-current={index === step ? "step" : undefined} aria-label={`${index + 1}. ${sectionNavLabel(id, answers)}`} onClick={() => onStep(index)}>
                  <span className="smq-step-full">{index + 1}. {sectionNavLabel(id, answers)}</span>
                  <span className="smq-step-short" aria-hidden="true">{index + 1}</span>
                </button>
              </li>
            ))}
          </ol>
          {form.phone || form.websiteUrl ? (
            <p className="smq-help">
              {form.phone ? <span>Agency contact {form.phone}. </span> : null}
              {form.websiteUrl ? <a href={form.websiteUrl}>{form.websiteUrl.replace(/^https?:\/\//, "")}</a> : null}
            </p>
          ) : null}
        </aside>
        <main className="smq-card">
          {step === 0 ? (
            <header>
              <span className="smq-type">{mandateLabel}</span>
              <h1>Let&apos;s prepare your selling mandate</h1>
              <p className="smq-lead">Tell {form.agencyName} about the owner, the property and your selling instructions. Your agent will review your answers and guide you through the next steps.</p>
              <p className="smq-support">You can save an unfinished form before sending it. Fields marked <span className="smq-req">*</span> are needed before you send it for review.</p>
            </header>
          ) : (
            <header>
              <span className="smq-type">{mandateLabel} · step {step + 1} of {sections.length}</span>
              <h1>{copy.title}</h1>
            </header>
          )}
          <p className="smq-lead">{copy.intro}</p>
          {form.draftExists ? <p className="smq-note" role="status">A draft was started in another browser. This page does not show those answers. Ask your agent for a resume link to continue that draft.</p> : null}
          {visible.some((field) => field.instruction) ? (
            <div className="smq-note">
              {[...new Set(visible.map((field) => field.instruction).filter(Boolean))].map((instruction) => (
                <p key={instruction}>Your agent asked you to correct this section: {instruction}</p>
              ))}
            </div>
          ) : null}
          {error ? <p className="smq-alert" role="alert">{error}</p> : null}
          {Object.keys(fieldErrors).length ? (
            <div className="smq-alert" role="alert">
              {Object.entries(fieldErrors).map(([key, message]) => (
                <p key={key}><a href={`#${baseId}-${key}`}>{message}</a></p>
              ))}
            </div>
          ) : null}

          {section !== "review" ? visible.map((field) => {
            const text = fieldCopy(field.key, answers);
            const described = `${baseId}-${field.key}-help`;
            const invalid = Boolean(fieldErrors[field.key]);
            return (
              <div className="smq-field" key={field.key} id={`${baseId}-${field.key}`}>
                {field.key === "sellerTitle" && isCompany(answers) ? <h2 className="smq-sub">The person completing this form</h2> : null}
                {field.key === "companyName" ? <h2 className="smq-sub">The company</h2> : null}
                {field.key === "ownerKind" ? (
                  <span id={`${baseId}-${field.key}-label`}>{text.label}</span>
                ) : (
                  <label htmlFor={`${baseId}-${field.key}-input`}>
                    <span>{text.label}{field.requiredToSubmit || (isCompany(answers) && (field.key === "companyName" || field.key === "representativeName")) ? <span className="smq-req"> *</span> : null}</span>
                  </label>
                )}
                {text.help ? <p className="smq-help" id={described}>{text.help}</p> : null}
                {field.key === "pep" ? (
                  <button type="button" className="smq-text" aria-expanded={pepOpen} onClick={() => setPepOpen((open) => !open)}>
                    {pepOpen ? "Hide the PEP explanation" : "Read what a PEP declaration means"}
                  </button>
                ) : null}
                {field.key === "pep" && pepOpen ? <p className="smq-help">{PEP_EXPLANATION}</p> : null}
                {field.locked ? <p>{answers[field.key] || "—"}</p> : field.key === "ownerKind" ? (
                  <div className="smq-cards" role="radiogroup" aria-labelledby={`${baseId}-${field.key}-label`}>
                    {["Individual", "Company"].map((option) => (
                      <button key={option} type="button" role="radio" aria-checked={answers.ownerKind === option} onClick={() => onAnswer("ownerKind", option)} onKeyDown={(event) => {
                        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                        event.preventDefault();
                        onAnswer("ownerKind", option === "Individual" ? "Company" : "Individual");
                      }}>
                        <strong>{option === "Company" ? "A company" : "An individual"}</strong>
                        <small>{option === "Company" ? "The registered owner is a company. You will add the person completing this form separately." : "The registered owner is a person."}</small>
                        {answers.ownerKind === option ? <small>Selected</small> : null}
                      </button>
                    ))}
                  </div>
                ) : field.input === "textarea" ? (
                  <textarea id={`${baseId}-${field.key}-input`} aria-describedby={described} aria-invalid={invalid} value={answers[field.key] ?? ""} onChange={(event) => onAnswer(field.key, event.target.value)} />
                ) : field.input === "choice" ? (
                  <select id={`${baseId}-${field.key}-input`} aria-describedby={described} aria-invalid={invalid} value={answers[field.key] ?? ""} onChange={(event) => onAnswer(field.key, event.target.value)}>
                    <option value="">Choose</option>
                    {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input
                    id={`${baseId}-${field.key}-input`}
                    aria-describedby={described}
                    aria-invalid={invalid}
                    autoComplete={autocompleteFor(field.key)}
                    inputMode={field.input === "money" ? "decimal" : field.key.toLowerCase().includes("phone") || field.key === "cell" ? "tel" : undefined}
                    type={field.input === "date" ? "date" : field.key === "email" || field.key === "companyEmail" ? "email" : "text"}
                    value={answers[field.key] ?? ""}
                    onChange={(event) => onAnswer(field.key, event.target.value)}
                  />
                )}
                {field.input === "date" && formatDisplayDate(answers[field.key]) ? <p className="smq-help">{formatDisplayDate(answers[field.key])}</p> : null}
                {field.key === "mandatePriceWords" && !answers.mandatePriceWords?.trim() && suggestPriceWords(answers.mandatePrice) ? (
                  <button type="button" className="smq-text" onClick={() => onAnswer("mandatePriceWords", suggestPriceWords(answers.mandatePrice) ?? "")}>Fill the words from the amount</button>
                ) : null}
                {field.key === "representativeName" && !answers.representativeName?.trim() && `${answers.givenName ?? ""} ${answers.surname ?? ""}`.trim() ? (
                  <button type="button" className="smq-text" onClick={() => onAnswer("representativeName", `${answers.givenName ?? ""} ${answers.surname ?? ""}`.replace(/\s+/g, " ").trim())}>Use the name entered above</button>
                ) : null}
                {field.key === "occupantName" && answers.occupation === "Owner occupied" && answers.registeredOwner ? (
                  <button type="button" className="smq-text" onClick={() => onAnswer("occupantName", answers.registeredOwner)}>Use the registered owner&apos;s name as the occupant</button>
                ) : null}
                {invalid ? <p className="smq-alert" role="alert">{fieldErrors[field.key]}</p> : null}
              </div>
            );
          }) : (
            <div>
              {sections.filter((id) => id !== "review").map((id) => {
                const needed = new Set(["propertyAddress", "registeredOwner", "mandatePrice", "askingPrice", ...(isCompany(answers) ? ["companyName", "representativeName"] : [])]);
                const rows = fieldsInSection(id, form.fields, answers).filter((field) => (answers[field.key] ?? "").trim() || needed.has(field.key) || fieldErrors[field.key]);
                if (!rows.length) return null;
                return (
                  <section className="smq-review" key={id}>
                    <h3>{sectionCopy(id, answers).title}</h3>
                    {rows.map((field) => (
                      <div className="smq-row" key={field.key}>
                        <span>{fieldCopy(field.key, answers).label}{fieldErrors[field.key] ? <strong> — {fieldErrors[field.key]}</strong> : null}</span>
                        <b>{displayValue(field.key, answers[field.key]) || "Still needed"}</b>
                      </div>
                    ))}
                    <button type="button" className="smq-text" onClick={() => onStep(sections.indexOf(id))}>Edit {sectionCopy(id, answers).title}</button>
                  </section>
                );
              })}
              {terms ? <p className="smq-note">{terms}</p> : null}
              {form.clauses.length ? (
                <section className="smq-review">
                  <h3>Approved terms on this mandate</h3>
                  {form.clauses.map((clause, index) => <p key={`${index}-${clause.slice(0, 24)}`}>{clause}</p>)}
                  <p className="smq-help">Sending this form does not sign these terms.</p>
                </section>
              ) : null}
              <p className="smq-support">Sending this form does not sign the mandate, approve it, verify evidence, or publish a listing.</p>
            </div>
          )}

          {companyKept && section === "ownership" ? <p className="smq-note">Company details stay on this page until you save. Saving while an individual is selected does not include those company answers.</p> : null}
          <p className="smq-live" role="status" aria-live="polite">
            {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved just now" : ""}
          </p>
          <div className="smq-actions">
            {step > 0 ? <button type="button" className="smq-ghost" onClick={onBack}>Back</button> : null}
            <button type="button" className="smq-ghost" onClick={onSave} disabled={saveState === "saving"}>Save draft</button>
            {section === "review" ? (
              <button type="button" className="smq-solid" onClick={onSubmit} disabled={saveState === "saving"}>Send for review</button>
            ) : (
              <button type="button" className="smq-solid" onClick={onContinue} disabled={saveState === "saving"}>Continue</button>
            )}
          </div>
          <p className="smq-foot">Prepared with SegmiQ for {form.agencyName}. {form.title}</p>
        </main>
      </div>
    </div>
  );
}

function displayValue(key: string, value: string | undefined): string {
  const date = key.toLowerCase().includes("date") ? formatDisplayDate(value) : null;
  return date || value || "";
}

function autocompleteFor(key: string): string | undefined {
  if (key === "givenName") return "given-name";
  if (key === "surname") return "family-name";
  if (key === "email" || key === "companyEmail") return "email";
  if (key === "cell" || key === "representativePhone" || key === "occupantPhone") return "tel";
  if (key === "propertyAddress" || key === "residentialAddress") return "street-address";
  return undefined;
}

export function stepForError(sections: readonly SectionId[], key: string): number {
  const section = sectionForKey(key);
  const index = sections.indexOf(section);
  return index >= 0 ? index : 0;
}
