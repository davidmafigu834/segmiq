"use client";

import { useState } from "react";
import { SignaturePad } from "@/components/real-estate/workflow/SignaturePad";
import { clientTermsCopy, fieldCopy, isCompany, type ClientField } from "@/lib/real-estate/seller-intake/client-form";
import type { SellerFormModel } from "@/components/real-estate/seller-intake/SellerMandateExperience";
import type { MandateMarks } from "@/components/real-estate/seller-intake/mandate-paper-data";

type Step = "property" | "price" | "who" | "seller" | "work" | "company" | "terms" | "sign";

const fieldClass = "mt-1 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[15px] text-sales-text-primary placeholder:text-sales-text-muted focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60";
const areaClass = "mt-1 min-h-24 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2 text-[15px] text-sales-text-primary focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60";
const lineBtn = "inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";
const limeBtn = "inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60";
const choice = (on: boolean) =>
  `flex min-h-14 items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${
    on ? "border-sales-text-primary bg-sales-surface-active" : "border-sales-border bg-sales-bg hover:bg-sales-surface-hover"
  }`;

const SOLE_STEPS: Step[] = ["property", "price", "who", "terms", "sign"];
const OPEN_STEPS: Step[] = ["property", "price", "seller", "work", "company", "terms", "sign"];
const STEP_LABEL: Record<Step, string> = {
  property: "The property",
  price: "The price",
  who: "Who signs",
  seller: "The seller",
  work: "Work and funds",
  company: "The company",
  terms: "The mandate",
  sign: "Sign",
};

function digits(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, fraction] = cleaned.split(".");
  return fraction !== undefined ? `${whole}.${fraction.slice(0, 2)}` : whole;
}

function grouped(value: string) {
  const [whole, fraction] = digits(value).split(".");
  if (!whole) return "";
  const shown = Number(whole).toLocaleString("en-US");
  return fraction !== undefined ? `${shown}.${fraction}` : shown;
}

export function SalesMandateForm({
  form,
  answers,
  error,
  fieldErrors,
  saveState,
  marks,
  onAnswer,
  onMarks,
  onSave,
  onSubmit,
}: {
  form: SellerFormModel;
  answers: Record<string, string>;
  error: string | null;
  fieldErrors: Record<string, string>;
  saveState: "idle" | "saving" | "saved" | "error";
  marks: MandateMarks;
  onAnswer: (key: string, value: string) => void;
  onMarks: (patch: Partial<MandateMarks>) => void;
  onSave: () => Promise<boolean>;
  onSubmit: () => void;
}) {
  const company = isCompany(answers);
  const steps = (form.kind === "sole" ? SOLE_STEPS : OPEN_STEPS).filter((step) => step !== "company" || company);
  const [index, setIndex] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const step = steps[Math.min(index, steps.length - 1)];
  const byKey = new Map(form.fields.map((field) => [field.key, field]));
  const agency = form.agencyName.trim() || "the agency";

  function value(key: string) {
    return answers[key] ?? "";
  }

  function set(key: string, next: string) {
    setLocalError(null);
    onAnswer(key, next);
  }

  function present(key: string) {
    return byKey.has(key);
  }

  function block(message: string) {
    setLocalError(message);
    return false;
  }

  function ready() {
    if (step === "property") {
      if (present("propertyAddress") && value("propertyAddress").trim().length < 4) return block("Enter the property address.");
      if (present("registeredOwner") && value("registeredOwner").trim().length < 2) return block("Enter the registered owner.");
      if (form.kind === "sole" && present("residentialAddress") && value("residentialAddress").trim().length < 4) return block("Enter the owner’s residential address.");
      if (form.kind === "sole" && present("cell") && value("cell").replace(/\D/g, "").length < 9) return block("Enter a mobile number the agency can use.");
      if (form.kind === "open" && present("propertyCategory") && !value("propertyCategory")) return block("Choose a property category.");
      if (value("propertyCategory") === "Other" && value("propertyCategoryOther").trim().length < 2) return block("Name the other category.");
      if (form.kind === "open" && present("propertyRights") && !value("propertyRights")) return block("Choose the property rights.");
      if (form.kind === "open" && present("titleReference") && value("titleReference").trim().length < 2) return block("Enter the title deed or share certificate number.");
      if (form.kind === "open" && present("propertyDescription") && value("propertyDescription").trim().length < 8) return block("Describe the property.");
      if (form.kind === "open" && present("occupation") && !value("occupation")) return block("Say who occupies the property.");
      if (value("occupation") === "Tenant occupied" && value("occupantName").trim().length < 2) return block("Enter the tenant’s name.");
      if (value("occupation") === "Tenant occupied" && value("occupantPhone").replace(/\D/g, "").length < 9) return block("Enter the tenant’s cell number.");
    }
    if (step === "price") {
      if (form.kind === "open" && present("mandateStartDate") && !value("mandateStartDate")) return block("Enter the mandate start date.");
      if (form.kind === "open" && present("mandateEndDate") && !value("mandateEndDate")) return block("Enter the mandate end date.");
      if (form.kind === "open" && value("mandateStartDate") && value("mandateEndDate") && value("mandateEndDate") < value("mandateStartDate")) return block("The end date needs to be on or after the start date.");
      if (form.kind === "open" && present("mandatePrice") && !digits(value("mandatePrice"))) return block("Enter the mandate price.");
      if (form.kind === "open" && present("mandatePriceWords") && value("mandatePriceWords").trim().length < 3) return block("Write the mandate price in words.");
      if (form.kind === "open" && present("paymentMode") && !value("paymentMode")) return block("Choose how payment is preferred.");
      if (value("paymentMode") === "Other" && value("paymentModeOther").trim().length < 2) return block("Say what the other payment is.");
      if (present("askingPrice") && !digits(value("askingPrice"))) return block("Enter the asking price before commission.");
    }
    if (step === "who" && company) {
      if (!value("companyName").trim()) return block("Enter the company name.");
      if (!value("representativeName").trim()) return block("Enter the person signing for the company.");
      if (!marks.surety) return block("A company owner needs the signatory to accept the surety.");
    }
    if (step === "seller") {
      if (present("surname") && value("surname").trim().length < 2) return block("Enter the surname.");
      if (present("givenName") && value("givenName").trim().length < 2) return block("Enter the name.");
      if (present("cell") && value("cell").replace(/\D/g, "").length < 9) return block("Enter a cell number.");
      if (present("residentialAddress") && value("residentialAddress").trim().length < 4) return block("Enter the present residential address.");
      if (present("pep") && !value("pep")) return block("Say whether this person is politically exposed.");
      if (value("maritalStatus") === "Married" && !value("spouseName").trim()) return block("Enter the spouse’s name.");
    }
    if (step === "company") {
      if (!value("companyName").trim()) return block("Enter the company name.");
      if (!value("representativeName").trim()) return block("Enter the company representative.");
      if (present("representativeIdentity") && value("representativeIdentity").trim().length < 4) return block("Enter the representative’s identity number.");
      if (!marks.surety) return block("The representative accepts the surety for the company’s commission.");
    }
    if (step === "terms" && !agreed) return block("Read the mandate and confirm you grant it.");
    if (step === "sign") {
      if (marks.place.trim().length < 2) return block("Enter the place where this is signed.");
      if (!marks.signature) return block("Draw the signature.");
      if (marks.witness.trim().length < 2) return block("Enter the witness’s name.");
      if (!marks.witnessSign) return block("The witness draws their signature on this screen.");
    }
    return true;
  }

  async function next() {
    if (!ready()) return;
    const saved = await onSave();
    if (!saved) return;
    setIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function grant() {
    if (!ready()) return;
    onSubmit();
  }

  const shownError = localError || error;

  return (
    <div className="mx-auto w-full max-w-[1040px] space-y-5">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <aside className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface lg:sticky lg:top-6">
          <div className="border-b border-sales-border-subtle px-5 py-5">
            <p className="text-[13px] font-medium text-sales-text-muted">{agency} sent this</p>
            {form.phone ? <p className="mt-1 text-[13px] text-sales-text-secondary">{form.phone}</p> : null}
            <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">{form.kind === "sole" ? "Sole mandate" : "Open mandate to sell"}</h1>
            <p className="mt-2 text-[15px] text-sales-text-secondary">{value("propertyAddress").trim() || "Property address"}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-5">
            <div>
              <dt className="text-[12px] text-sales-text-muted">Registered owner</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">{value("registeredOwner").trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-sales-text-muted">{form.kind === "sole" ? "Asking price" : "Mandate price"}</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">{digits(form.kind === "sole" ? value("askingPrice") : value("mandatePrice")) ? `US$${grouped(form.kind === "sole" ? value("askingPrice") : value("mandatePrice"))}` : "—"}</dd>
            </div>
          </dl>
        </aside>

        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-5 py-5" aria-live="polite">
          <p className="text-[13px] font-medium text-sales-text-muted">Part {index + 1} of {steps.length} · {STEP_LABEL[step]}</p>
          <div className="mt-3 flex items-center gap-2" aria-hidden>
            {steps.map((item, itemIndex) => (
              <span key={item} className={`h-1.5 flex-1 rounded-full ${itemIndex <= index ? "bg-sales-text-primary" : "bg-sales-border-subtle"}`} />
            ))}
          </div>

          {step === "property" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">{form.kind === "sole" ? "Confirm the property" : "The property"}</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">{form.kind === "sole" ? "Enter the property this mandate covers. The address is blank until you type it." : "This is an open mandate. Other agents can also be instructed. The address starts blank."}</p>
              <Text field={byKey.get("propertyAddress")} answers={answers} error={fieldErrors.propertyAddress} onChange={set} area />
              <Text field={byKey.get("registeredOwner")} answers={answers} error={fieldErrors.registeredOwner} onChange={set} />
              {form.kind === "sole" ? <Text field={byKey.get("residentialAddress")} answers={answers} error={fieldErrors.residentialAddress} onChange={set} /> : null}
              {form.kind === "sole" ? <Text field={byKey.get("cell")} answers={answers} error={fieldErrors.cell} onChange={set} /> : null}
              <Chips field={byKey.get("propertyCategory")} value={value("propertyCategory")} onPick={(next) => set("propertyCategory", next)} />
              {value("propertyCategory") === "Other" ? <Text field={byKey.get("propertyCategoryOther")} answers={answers} error={fieldErrors.propertyCategoryOther} onChange={set} /> : null}
              <Chips field={byKey.get("propertyRights")} value={value("propertyRights")} onPick={(next) => set("propertyRights", next)} />
              <Text field={byKey.get("titleReference")} answers={answers} error={fieldErrors.titleReference} onChange={set} />
              <Text field={byKey.get("propertyDescription")} answers={answers} error={fieldErrors.propertyDescription} onChange={set} area />
              <Chips field={byKey.get("occupation")} value={value("occupation")} onPick={(next) => set("occupation", next)} />
              {value("occupation") === "Tenant occupied" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Text field={byKey.get("occupantName")} answers={answers} error={fieldErrors.occupantName} onChange={set} bare />
                  <Text field={byKey.get("occupantPhone")} answers={answers} error={fieldErrors.occupantPhone} onChange={set} bare />
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "price" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">{form.kind === "sole" ? "Asking price" : "Period and price"}</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">{form.kind === "sole" ? "This is the price before commission. Commission is worked out on the selling price, which can be lower if you later authorise it." : "The open mandate runs between the two dates you enter. It does not appoint one agency alone."}</p>
              {form.kind === "open" ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Text field={byKey.get("mandateStartDate")} answers={answers} error={fieldErrors.mandateStartDate} onChange={set} bare />
                  <Text field={byKey.get("mandateEndDate")} answers={answers} error={fieldErrors.mandateEndDate} onChange={set} bare />
                </div>
              ) : null}
              <Money field={byKey.get("mandatePrice")} value={value("mandatePrice")} error={fieldErrors.mandatePrice} onChange={(next) => set("mandatePrice", digits(next))} />
              <Text field={byKey.get("mandatePriceWords")} answers={answers} error={fieldErrors.mandatePriceWords} onChange={set} />
              <Chips field={byKey.get("paymentMode")} value={value("paymentMode")} onPick={(next) => set("paymentMode", next)} />
              {value("paymentMode") === "Other" ? <Text field={byKey.get("paymentModeOther")} answers={answers} error={fieldErrors.paymentModeOther} onChange={set} /> : null}
              <Money field={byKey.get("askingPrice")} value={value("askingPrice")} error={fieldErrors.askingPrice} onChange={(next) => set("askingPrice", digits(next))} />
            </div>
          ) : null}

          {step === "who" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Who is signing</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">Say if you are the owner, or if you are signing for the owner.</p>
              <div className="mt-5 grid gap-2">
                <button type="button" aria-pressed={!company} onClick={() => set("ownerKind", "Individual")} className={choice(!company)}><span className="text-[15px] font-semibold">A person</span></button>
                <button type="button" aria-pressed={company} onClick={() => set("ownerKind", "Company")} className={choice(company)}>
                  <span><span className="block text-[15px] font-semibold">A company</span><span className="mt-0.5 block text-[13px] text-sales-text-secondary">The person who signs also stands surety for the commission.</span></span>
                </button>
              </div>
              {company ? (
                <div className="mt-4">
                  <Text field={byKey.get("companyName")} answers={answers} error={fieldErrors.companyName} onChange={set} />
                  <Text field={byKey.get("representativeName")} answers={answers} error={fieldErrors.representativeName} onChange={set} />
                  <Text field={byKey.get("representativePhone")} answers={answers} error={fieldErrors.representativePhone} onChange={set} />
                  <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed">
                    <input type="checkbox" checked={marks.surety} onChange={(event) => onMarks({ surety: event.target.checked })} className="mt-1 h-4 w-4" />
                    <span>I bind myself, jointly and severally, as surety for {value("companyName").trim() || "the company"}’s commission to {agency}.</span>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "seller" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Seller details</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">If a company owns the property, these are the representative’s details.</p>
              <Text field={byKey.get("sellerTitle")} answers={answers} error={fieldErrors.sellerTitle} onChange={set} />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Text field={byKey.get("surname")} answers={answers} error={fieldErrors.surname} onChange={set} bare />
                <Text field={byKey.get("givenName")} answers={answers} error={fieldErrors.givenName} onChange={set} bare />
                <Text field={byKey.get("nationality")} answers={answers} error={fieldErrors.nationality} onChange={set} bare />
                <Text field={byKey.get("identityNumber")} answers={answers} error={fieldErrors.identityNumber} onChange={set} bare />
              </div>
              <Chips field={byKey.get("maritalStatus")} value={value("maritalStatus")} options={["Single", "Married", "Divorced", "Widowed"]} onPick={(next) => set("maritalStatus", next)} />
              {value("maritalStatus") === "Married" ? <Text field={byKey.get("spouseName")} answers={answers} error={fieldErrors.spouseName} onChange={set} /> : null}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Text field={byKey.get("cell")} answers={answers} error={fieldErrors.cell} onChange={set} bare />
                <Text field={byKey.get("email")} answers={answers} error={fieldErrors.email} onChange={set} bare />
              </div>
              <Text field={byKey.get("residentialAddress")} answers={answers} error={fieldErrors.residentialAddress} onChange={set} />
              <Chips field={byKey.get("pep")} value={value("pep")} onPick={(next) => set("pep", next)} />
              <p className="mt-5 text-[13px] font-medium text-sales-text-secondary">The registered owner is</p>
              <div className="mt-2 grid gap-2">
                <button type="button" aria-pressed={!company} onClick={() => set("ownerKind", "Individual")} className={choice(!company)}><span className="text-[15px] font-semibold">A person</span></button>
                <button type="button" aria-pressed={company} onClick={() => set("ownerKind", "Company")} className={choice(company)}>
                  <span><span className="block text-[15px] font-semibold">A company</span><span className="mt-0.5 block text-[13px] text-sales-text-secondary">The next part asks for the company, its shareholders, and the documents.</span></span>
                </button>
              </div>
            </div>
          ) : null}

          {step === "work" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Work and funds</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Text field={byKey.get("occupationJob")} answers={answers} error={fieldErrors.occupationJob} onChange={set} bare />
                <Text field={byKey.get("industry")} answers={answers} error={fieldErrors.industry} onChange={set} bare />
                <Text field={byKey.get("position")} answers={answers} error={fieldErrors.position} onChange={set} bare />
                <Text field={byKey.get("employerName")} answers={answers} error={fieldErrors.employerName} onChange={set} bare />
              </div>
              <Text field={byKey.get("employerAddress")} answers={answers} error={fieldErrors.employerAddress} onChange={set} />
              <Text field={byKey.get("sourceOfFunds")} answers={answers} error={fieldErrors.sourceOfFunds} onChange={set} />
            </div>
          ) : null}

          {step === "company" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">The company</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Text field={byKey.get("companyName")} answers={answers} error={fieldErrors.companyName} onChange={set} bare />
                <Text field={byKey.get("companyIndustry")} answers={answers} error={fieldErrors.companyIndustry} onChange={set} bare />
              </div>
              <Text field={byKey.get("companyAddress")} answers={answers} error={fieldErrors.companyAddress} onChange={set} />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Text field={byKey.get("companyEmail")} answers={answers} error={fieldErrors.companyEmail} onChange={set} bare />
                <Text field={byKey.get("companyPhones")} answers={answers} error={fieldErrors.companyPhones} onChange={set} bare />
                <Text field={byKey.get("representativeName")} answers={answers} error={fieldErrors.representativeName} onChange={set} bare />
                <Text field={byKey.get("representativeIdentity")} answers={answers} error={fieldErrors.representativeIdentity} onChange={set} bare />
                <Text field={byKey.get("representativePosition")} answers={answers} error={fieldErrors.representativePosition} onChange={set} bare />
                <Text field={byKey.get("representativePhone")} answers={answers} error={fieldErrors.representativePhone} onChange={set} bare />
              </div>
              <Text field={byKey.get("representativeAddress")} answers={answers} error={fieldErrors.representativeAddress} onChange={set} />
              <Text field={byKey.get("shareholderLines")} answers={answers} error={fieldErrors.shareholderLines} onChange={set} area />
              <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed">
                <input type="checkbox" checked={marks.surety} onChange={(event) => onMarks({ surety: event.target.checked })} className="mt-1 h-4 w-4" />
                <span>I bind myself, jointly and severally, as surety for {value("companyName").trim() || "the company"}’s commission to {agency}.</span>
              </label>
            </div>
          ) : null}

          {step === "terms" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">What you grant</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">{form.kind === "sole" ? `For at least two months, ${agency} is the only agency that may sell the property.` : "This mandate does not stop you from instructing another agency."}</p>
              {clientTermsCopy(form.exclusivityNote) ? <p className="mt-3 text-[14px] leading-relaxed text-sales-text-secondary">{clientTermsCopy(form.exclusivityNote)}</p> : null}
              {form.clauses.length ? (
                <ol className="mt-4 space-y-2 text-[14px] leading-relaxed text-sales-text-secondary">
                  {form.clauses.map((clause) => <li key={clause}>{clause}</li>)}
                </ol>
              ) : null}
              <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed">
                <input type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setLocalError(null); }} className="mt-1 h-4 w-4" />
                <span>{form.kind === "sole" ? `I grant ${agency} the sole mandate for at least two months, and I agree to commission of 5% of the selling price plus VAT at 15.5%.` : `I grant ${agency} this open mandate, and I agree to commission of 5% of the selling price plus VAT at 15.5% of that commission.`}</span>
              </label>
            </div>
          ) : null}

          {step === "sign" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Sign it</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">The witness is with you and signs on this same screen.</p>
              <label className="mt-5 block text-[13px] font-medium text-sales-text-secondary">
                Signed at
                <input value={marks.place} onChange={(event) => onMarks({ place: event.target.value })} className={fieldClass} />
              </label>
              <div className="mt-4">
                <p className="text-[13px] font-medium text-sales-text-secondary">Signature of {value("representativeName").trim() || value("registeredOwner").trim() || "the owner or representative"}</p>
                <SignaturePad onChange={(signature) => onMarks({ signature })} />
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                Witness
                <input value={marks.witness} onChange={(event) => onMarks({ witness: event.target.value })} className={fieldClass} />
              </label>
              <div className="mt-4">
                <p className="text-[13px] font-medium text-sales-text-secondary">Witness signature</p>
                <SignaturePad onChange={(witnessSign) => onMarks({ witnessSign })} />
              </div>
            </div>
          ) : null}

          {shownError ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{shownError}</p> : null}
          {saveState === "error" && !shownError ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">The latest answers could not be saved. Try again before leaving this page.</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {index > 0 ? <button type="button" onClick={() => { setLocalError(null); setIndex((current) => current - 1); }} className={lineBtn}>Back</button> : null}
            {step === "sign" ? (
              <button type="button" disabled={saveState === "saving"} onClick={grant} className={limeBtn}>{saveState === "saving" ? "Sending" : "Grant the mandate"}</button>
            ) : (
              <button type="button" disabled={saveState === "saving"} onClick={() => void next()} className={limeBtn}>{saveState === "saving" ? "Saving" : "Continue"}</button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Text({
  field,
  answers,
  error,
  onChange,
  area,
  bare,
}: {
  field?: ClientField;
  answers: Record<string, string>;
  error?: string;
  onChange: (key: string, value: string) => void;
  area?: boolean;
  bare?: boolean;
}) {
  if (!field) return null;
  const copy = fieldCopy(field.key, answers);
  const Input = area ? "textarea" : "input";
  return (
    <label className={`${bare ? "" : "mt-4"} block text-[13px] font-medium text-sales-text-secondary`}>
      {copy.label}
      <Input
        type={field.input === "date" ? "date" : field.key.toLowerCase().includes("email") ? "email" : "text"}
        value={answers[field.key] ?? ""}
        disabled={field.locked}
        onChange={(event) => onChange(field.key, event.target.value)}
        className={area ? areaClass : fieldClass}
      />
      {field.instruction ? <span className="mt-1 block font-medium text-sales-danger-fg">{field.instruction}</span> : null}
      {error ? <span className="mt-1 block font-medium text-sales-danger-fg">{error}</span> : null}
    </label>
  );
}

function Money({ field, value, error, onChange }: { field?: ClientField; value: string; error?: string; onChange: (value: string) => void }) {
  if (!field) return null;
  const copy = fieldCopy(field.key, {});
  return (
    <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
      {copy.label}
      <span className="mt-1 flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-bg focus-within:shadow-[var(--sales-focus-ring)]">
        <span className="pl-3 text-[15px] font-semibold">US$</span>
        <input value={grouped(value)} inputMode="decimal" aria-label={copy.label} disabled={field.locked} onChange={(event) => onChange(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] text-sales-text-primary outline-none" />
      </span>
      {error ? <span className="mt-1 block font-medium text-sales-danger-fg">{error}</span> : null}
    </label>
  );
}

function Chips({
  field,
  value,
  options,
  onPick,
}: {
  field?: ClientField;
  value: string;
  options?: string[];
  onPick: (value: string) => void;
}) {
  if (!field) return null;
  const choices = options ?? field.options ?? [];
  if (!choices.length && field.input !== "choice") return null;
  const copy = fieldCopy(field.key, {});
  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium text-sales-text-secondary">{copy.label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((option) => (
          <button key={option} type="button" aria-pressed={value === option} disabled={field.locked} onClick={() => onPick(option)} className={`h-11 rounded-[10px] border px-3 text-[14px] font-semibold focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${value === option ? "border-sales-text-primary bg-sales-surface-active" : "border-sales-border bg-sales-bg hover:bg-sales-surface-hover"}`}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
