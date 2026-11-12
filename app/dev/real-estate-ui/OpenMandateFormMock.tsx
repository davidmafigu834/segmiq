"use client";

import { useState, type ReactNode } from "react";
import { SignaturePad } from "@/components/real-estate/workflow/SignaturePad";
import { OpenMandatePdf, SellerPdf } from "@/components/real-estate/seller-intake/MandatePaper";

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4
 * Genre: modern-minimal · macrostructure: Workbench · design.md
 * Audience: a seller who opened an open-mandate link
 * Use: grant an open mandate to sell
 * Theme: locked sales tokens, lime only on the primary action
 */

const SIGNED_ON = "12 November 2026";
const NEGOTIATOR = "Nyasha Moyo";

const CATEGORIES = ["Land", "House", "Cluster/Townhouse", "Industrial", "Commercial", "Farm", "Other"] as const;
const RIGHTS = ["Full title", "Sectional title", "Share transfer", "Cession"] as const;
const TITLES = ["Mr", "Mrs", "Miss", "Dr", "Prof", "Other"] as const;
const PAYMENTS = ["Cash", "Electronic transfer", "Other"] as const;

const CLAUSES = [
  {
    id: "find",
    title: "Find a buyer",
    summary: "The agency looks for a buyer at the mandate price, or at a lower price you later authorise.",
  },
  {
    id: "fee",
    title: "5% plus VAT",
    summary: "Commission is 5% of the selling price, plus VAT at 15.5% of the commission. The VAT is not 15.5% of the selling price.",
    detail: "The Real Estate Agents Council permits this under the Professional Conduct Amendment Rules, 2016 (No. 6).",
  },
  {
    id: "ads",
    title: "Advertising and a sold board",
    summary: "The agency may advertise the property on social media, and may put up a board after the sale saying they sold it.",
  },
] as const;

type Step = "property" | "price" | "seller" | "work" | "company" | "terms" | "sign" | "sent";
type OwnerKind = "person" | "company";

const field = "mt-1 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[15px] text-sales-text-primary placeholder:text-sales-text-muted focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";
const area = "mt-1 min-h-24 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2 text-[15px] text-sales-text-primary placeholder:text-sales-text-muted focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";
const choice = (on: boolean) =>
  `flex min-h-14 items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${
    on ? "border-sales-text-primary bg-sales-surface-active" : "border-sales-border bg-sales-bg hover:bg-sales-surface-hover"
  }`;
const lineBtn = "inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";
const limeBtn = "inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function grouped(digits: string) {
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function moneyFromCents(cents: number) {
  const whole = cents % 100 === 0;
  return `US$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function commissionOf(digits: string) {
  if (!digits) return null;
  const price = Number(digits);
  if (!Number.isFinite(price) || price <= 0) return null;
  const priceCents = Math.round(price * 100);
  const fee = Math.round(priceCents * 5 / 100);
  const vat = Math.round(fee * 155 / 1000);
  return { fee, vat, total: fee + vat };
}

function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-11 items-center rounded-full border px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${
        on ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border bg-sales-surface text-sales-text-primary hover:bg-sales-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}

export function OpenMandateFormMock({ onBack }: { onBack?: () => void }) {
  const [step, setStep] = useState<Step>("property");
  const [address, setAddress] = useState("");
  const [owner, setOwner] = useState("");
  const [category, setCategory] = useState("");
  const [categoryOther, setCategoryOther] = useState("");
  const [rights, setRights] = useState("");
  const [deed, setDeed] = useState("");
  const [description, setDescription] = useState("");
  const [occupied, setOccupied] = useState<"owner" | "tenant" | "">("");
  const [occupant, setOccupant] = useState("");
  const [occupantCell, setOccupantCell] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [price, setPrice] = useState("");
  const [words, setWords] = useState("");
  const [payment, setPayment] = useState("");
  const [paymentOther, setPaymentOther] = useState("");
  const [asking, setAsking] = useState("");
  const [title, setTitle] = useState("");
  const [titleOther, setTitleOther] = useState("");
  const [surname, setSurname] = useState("");
  const [given, setGiven] = useState("");
  const [nationality, setNationality] = useState("");
  const [identity, setIdentity] = useState("");
  const [marital, setMarital] = useState("");
  const [spouse, setSpouse] = useState("");
  const [cell, setCell] = useState("");
  const [email, setEmail] = useState("");
  const [home, setHome] = useState("");
  const [pep, setPep] = useState<boolean | null>(null);
  const [occupation, setOccupation] = useState("");
  const [industry, setIndustry] = useState("");
  const [position, setPosition] = useState("");
  const [employer, setEmployer] = useState("");
  const [employerAddress, setEmployerAddress] = useState("");
  const [funds, setFunds] = useState("");
  const [ownerKind, setOwnerKind] = useState<OwnerKind>("person");
  const [company, setCompany] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyIndustry, setCompanyIndustry] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [representative, setRepresentative] = useState("");
  const [representativeId, setRepresentativeId] = useState("");
  const [representativeRole, setRepresentativeRole] = useState("");
  const [representativeAddress, setRepresentativeAddress] = useState("");
  const [representativePhone, setRepresentativePhone] = useState("");
  const [holders, setHolders] = useState(["", "", ""]);
  const [docs, setDocs] = useState({ directors: false, resolution: false, holders: false, cr16: false });
  const [surety, setSurety] = useState(false);
  const [openClause, setOpenClause] = useState<string | null>("fee");
  const [agreed, setAgreed] = useState(false);
  const [place, setPlace] = useState("Bulawayo");
  const [signature, setSignature] = useState("");
  const [witness, setWitness] = useState("");
  const [witnessSign, setWitnessSign] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pdf, setPdf] = useState(false);

  const steps: Step[] = ownerKind === "company"
    ? ["property", "price", "seller", "work", "company", "terms", "sign"]
    : ["property", "price", "seller", "work", "terms", "sign"];
  const labels: Record<Step, string> = {
    property: "The property",
    price: "The price",
    seller: "The seller",
    work: "Work and funds",
    company: "The company",
    terms: "The mandate",
    sign: "Sign",
    sent: "Sent",
  };
  const index = Math.max(0, steps.indexOf(step));
  const quote = commissionOf(price);
  const sellerName = [title === "Other" ? titleOther : title, given, surname].filter(Boolean).join(" ");

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function back() {
    const at = steps.indexOf(step);
    if (at > 0) go(steps[at - 1]);
  }

  function continueProperty() {
    if (address.trim().length < 4) return setError("Enter the property address.");
    if (owner.trim().length < 2) return setError("Enter the registered owner.");
    if (!category) return setError("Choose a property category.");
    if (category === "Other" && categoryOther.trim().length < 2) return setError("Name the other category.");
    if (!rights) return setError("Choose the property rights.");
    if (deed.trim().length < 2) return setError("Enter the title deed or share certificate number.");
    if (description.trim().length < 8) return setError("Describe the property.");
    if (!occupied) return setError("Say who occupies the property.");
    if (occupied === "tenant" && occupant.trim().length < 2) return setError("Enter the tenant’s name.");
    if (occupied === "tenant" && occupantCell.replace(/\D/g, "").length < 9) return setError("Enter the tenant’s cell number.");
    go("price");
  }

  function continuePrice() {
    if (!start || !end) return setError("Enter the mandate start and end dates.");
    if (end < start) return setError("The end date comes after the start date.");
    if (!quote) return setError("Enter the mandate price in US dollars.");
    if (words.trim().length < 3) return setError("Write the mandate price in words.");
    if (!payment) return setError("Choose how you prefer to be paid.");
    if (payment === "Other" && paymentOther.trim().length < 2) return setError("Say what the other payment is.");
    if (!digitsOnly(asking)) return setError("Enter the asking price before commission.");
    go("seller");
  }

  function continueSeller() {
    if (!title) return setError("Choose a title.");
    if (title === "Other" && titleOther.trim().length < 2) return setError("Enter the other title.");
    if (surname.trim().length < 2 || given.trim().length < 2) return setError("Enter the seller’s surname and name.");
    if (nationality.trim().length < 2) return setError("Enter the nationality.");
    if (identity.trim().length < 4) return setError("Enter the identity number.");
    if (!marital) return setError("Enter the marital status.");
    if (marital === "Married" && spouse.trim().length < 2) return setError("Enter the spouse’s name.");
    if (cell.replace(/\D/g, "").length < 9) return setError("Enter a cell number.");
    if (home.trim().length < 4) return setError("Enter the present residential address.");
    if (pep == null) return setError("Say whether you are a politically exposed person.");
    go("work");
  }

  function continueWork() {
    if (occupation.trim().length < 2) return setError("Enter the occupation.");
    if (funds.trim().length < 2) return setError("Enter the primary source of funds.");
    go(ownerKind === "company" ? "company" : "terms");
  }

  function continueCompany() {
    if (company.trim().length < 2) return setError("Enter the company name.");
    if (companyAddress.trim().length < 4) return setError("Enter the company address.");
    if (representative.trim().length < 2) return setError("Enter the company representative.");
    if (representativeId.trim().length < 4) return setError("Enter the representative’s identity number.");
    if (representativeRole.trim().length < 2) return setError("Enter the position held.");
    if (!docs.directors || !docs.resolution || !docs.holders || !docs.cr16) return setError("Confirm each document the company will provide.");
    if (!surety) return setError("The representative accepts the surety for the company’s commission.");
    go("terms");
  }

  function continueTerms() {
    if (!agreed) return setError("Read the mandate and confirm you grant it.");
    go("sign");
  }

  function send() {
    if (place.trim().length < 2) return setError("Enter the place where this is signed.");
    if (!signature) return setError("Draw the signature of the owner or representative.");
    if (witness.trim().length < 2) return setError("Enter the witness’s name.");
    if (!witnessSign) return setError("The witness draws their signature on this screen.");
    setError(null);
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setStep("sent");
    }, 700);
  }

  const period = start && end ? `${start} to ${end}` : "—";

  return (
    <div className="re-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3">
        <p className="text-[13px] text-sales-text-secondary">Sample of the open mandate a seller opens. The answers and the signatures stay on this page. Nothing is filed.</p>
        {onBack ? <button type="button" onClick={onBack} className={lineBtn}>Choose another mandate</button> : null}
      </div>

      {step === "sent" && pdf ? (
        <SellerPdf
          heading="Open mandate to sell"
          detail="Generated from the answers the seller entered. Give this copy to the seller, or go back to the file."
          onBack={() => setPdf(false)}
        >
          <OpenMandatePdf
            data={{
              address,
              owner,
              category: category === "Other" ? categoryOther : category,
              rights,
              deed,
              description,
              occupation: occupied === "tenant" ? `Tenant occupied. ${occupant.trim()}${occupantCell.trim() ? `, ${occupantCell.trim()}` : ""}` : occupied === "owner" ? "Owner occupied" : "",
              start,
              end,
              price,
              words,
              payment: payment === "Other" ? paymentOther : payment,
              asking,
              seller: sellerName,
              nationality,
              identity,
              marital,
              spouse,
              cell,
              email,
              home,
              pep: pep === true ? "Yes" : pep === false ? "No" : "",
              occupationJob: occupation,
              industry,
              position,
              employer,
              employerAddress,
              funds,
              company: ownerKind === "company" ? company : null,
              companyAddress,
              companyIndustry,
              companyEmail,
              companyPhone,
              representative,
              representativeId,
              representativeRole,
              representativeAddress,
              representativePhone,
              holders,
              documents: [
                docs.directors ? "Identity documents of the directors" : "",
                docs.resolution ? "The company’s resolution to sell" : "",
                docs.holders ? "Identity documents of shareholders at 10% or more" : "",
                docs.cr16 ? "CR16 with the beneficial owners" : "",
              ].filter(Boolean),
              surety,
              place,
              signature,
              witness,
              witnessSign,
            }}
          />
        </SellerPdf>
      ) : null}

      {step === "sent" && pdf ? null : <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <aside className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface lg:sticky lg:top-24">
          <div className="border-b border-sales-border-subtle px-5 py-5">
            <p className="text-[13px] font-medium text-sales-text-muted">{NEGOTIATOR} sent this</p>
            <p className="mt-1 text-[13px] text-sales-text-secondary">Landlords Junction Properties · 801B LAPF House, 8th Ave and Jason Moyo, Bulawayo</p>
            <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">Open mandate to sell</h1>
            <p className="mt-2 text-[15px] text-sales-text-secondary">{address.trim() || "Property address"}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-5">
            <div>
              <dt className="text-[12px] text-sales-text-muted">Registered owner</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">{owner.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-sales-text-muted">Mandate price</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">{price ? `US$${grouped(price)}` : "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[12px] text-sales-text-muted">Mandate period</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">{period}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[12px] text-sales-text-muted">Sales negotiator</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">{NEGOTIATOR}</dd>
            </div>
          </dl>
          <p className="border-t border-sales-border-subtle px-5 py-4 text-[13px] leading-relaxed text-sales-text-secondary">
            +263 77 735 2802 · +263 78 148 7621 · +263 77 101 8382
          </p>
        </aside>

        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-5 py-5" aria-live="polite">
          {step !== "sent" ? (
            <div>
              <p className="text-[13px] font-medium text-sales-text-muted">Part {index + 1} of {steps.length} · {labels[step]}</p>
              <div className="mt-3 flex items-center gap-2" aria-hidden>
                {steps.map((item, itemIndex) => (
                  <span key={item} className={`h-1.5 flex-1 rounded-full ${itemIndex <= index ? "bg-sales-text-primary" : "bg-sales-border-subtle"}`} />
                ))}
              </div>
            </div>
          ) : null}

          {step === "property" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">The property</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">This is an open mandate. Other agents can also be instructed. The address starts blank.</p>
              <label className="mt-5 block text-[13px] font-medium text-sales-text-secondary">Property address<input value={address} onChange={(event) => { setAddress(event.target.value); setError(null); }} className={field} /></label>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Registered owner<input value={owner} onChange={(event) => { setOwner(event.target.value); setError(null); }} className={field} /></label>
              <p className="mt-4 text-[13px] font-medium text-sales-text-secondary">Property category</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORIES.map((item) => <Chip key={item} on={category === item} onClick={() => { setCategory(item); setError(null); }}>{item}</Chip>)}
              </div>
              {category === "Other" ? <label className="mt-3 block text-[13px] font-medium text-sales-text-secondary">Other category<input value={categoryOther} onChange={(event) => setCategoryOther(event.target.value)} className={field} /></label> : null}
              <p className="mt-4 text-[13px] font-medium text-sales-text-secondary">Property rights</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {RIGHTS.map((item) => <Chip key={item} on={rights === item} onClick={() => { setRights(item); setError(null); }}>{item}</Chip>)}
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Title deed or share certificate number<input value={deed} onChange={(event) => setDeed(event.target.value)} className={field} /></label>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} className={area} /></label>
              <p className="mt-4 text-[13px] font-medium text-sales-text-secondary">Occupation</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button type="button" aria-pressed={occupied === "owner"} onClick={() => setOccupied("owner")} className={choice(occupied === "owner")}><span className="text-[15px] font-semibold">Owner occupied</span></button>
                <button type="button" aria-pressed={occupied === "tenant"} onClick={() => setOccupied("tenant")} className={choice(occupied === "tenant")}><span className="text-[15px] font-semibold">Tenant occupied</span></button>
              </div>
              {occupied === "tenant" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-[13px] font-medium text-sales-text-secondary">Tenant name<input value={occupant} onChange={(event) => setOccupant(event.target.value)} className={field} /></label>
                  <label className="block text-[13px] font-medium text-sales-text-secondary">Tenant cell<input value={occupantCell} inputMode="tel" onChange={(event) => setOccupantCell(event.target.value)} className={field} /></label>
                </div>
              ) : null}
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <button type="button" onClick={continueProperty} className={`${limeBtn} mt-5`}>Continue</button>
            </div>
          ) : null}

          {step === "price" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Period and price</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">The open mandate runs between the two dates you enter. It does not appoint one agency alone.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-sales-text-secondary">Mandate start<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Mandate end<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className={field} /></label>
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                Mandate price
                <span className="mt-1 flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-bg focus-within:shadow-[var(--sales-focus-ring)]">
                  <span className="pl-3 text-[15px] font-semibold">US$</span>
                  <input value={grouped(price)} inputMode="numeric" aria-label="Mandate price in US dollars" onChange={(event) => { setPrice(digitsOnly(event.target.value)); setError(null); }} className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none" />
                </span>
              </label>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Price in words<input value={words} onChange={(event) => setWords(event.target.value)} className={field} /></label>
              {quote ? (
                <div className="mt-4 rounded-[10px] border border-sales-border bg-sales-bg px-4 py-3">
                  <p className="text-[13px] font-medium text-sales-text-secondary">If it sells at this mandate price</p>
                  <dl className="mt-3 space-y-2 text-[14px]">
                    <div className="flex justify-between gap-3"><dt className="text-sales-text-secondary">Commission, 5%</dt><dd className="font-semibold tabular-nums">{moneyFromCents(quote.fee)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-sales-text-secondary">VAT, 15.5% of the commission</dt><dd className="font-semibold tabular-nums">{moneyFromCents(quote.vat)}</dd></div>
                    <div className="flex justify-between gap-3 border-t border-sales-border-subtle pt-2"><dt className="font-semibold">Together</dt><dd className="font-semibold tabular-nums">{moneyFromCents(quote.total)}</dd></div>
                  </dl>
                </div>
              ) : null}
              <p className="mt-4 text-[13px] font-medium text-sales-text-secondary">Preferred payment</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAYMENTS.map((item) => <Chip key={item} on={payment === item} onClick={() => setPayment(item)}>{item}</Chip>)}
              </div>
              {payment === "Other" ? <label className="mt-3 block text-[13px] font-medium text-sales-text-secondary">Other payment<input value={paymentOther} onChange={(event) => setPaymentOther(event.target.value)} className={field} /></label> : null}
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                Asking price, before commission
                <span className="mt-1 flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-bg focus-within:shadow-[var(--sales-focus-ring)]">
                  <span className="pl-3 text-[15px] font-semibold">US$</span>
                  <input value={grouped(asking)} inputMode="numeric" aria-label="Asking price before commission" onChange={(event) => setAsking(digitsOnly(event.target.value))} className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none" />
                </span>
              </label>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={back} className={lineBtn}>Back</button><button type="button" onClick={continuePrice} className={limeBtn}>Continue</button></div>
            </div>
          ) : null}

          {step === "seller" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Seller details</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">If a company owns the property, these are the representative’s details.</p>
              <p className="mt-5 text-[13px] font-medium text-sales-text-secondary">Title</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TITLES.map((item) => <Chip key={item} on={title === item} onClick={() => setTitle(item)}>{item}</Chip>)}
              </div>
              {title === "Other" ? <label className="mt-3 block text-[13px] font-medium text-sales-text-secondary">Other title<input value={titleOther} onChange={(event) => setTitleOther(event.target.value)} className={field} /></label> : null}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-sales-text-secondary">Surname<input value={surname} onChange={(event) => setSurname(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Name<input value={given} onChange={(event) => setGiven(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Nationality<input value={nationality} onChange={(event) => setNationality(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Identity number<input value={identity} onChange={(event) => setIdentity(event.target.value)} className={field} /></label>
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                Marital status
                <select value={marital} onChange={(event) => setMarital(event.target.value)} className={field}>
                  <option value="">Select</option>
                  <option>Single</option>
                  <option>Married</option>
                  <option>Divorced</option>
                  <option>Widowed</option>
                </select>
              </label>
              {marital === "Married" ? <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Name of spouse<input value={spouse} onChange={(event) => setSpouse(event.target.value)} className={field} /></label> : null}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-sales-text-secondary">Cell<input value={cell} inputMode="tel" onChange={(event) => setCell(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Email<input value={email} inputMode="email" onChange={(event) => setEmail(event.target.value)} className={field} /></label>
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Present residential address<input value={home} onChange={(event) => setHome(event.target.value)} className={field} /></label>
              <p className="mt-4 text-[13px] font-medium text-sales-text-secondary">Are you a politically exposed person?</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button type="button" aria-pressed={pep === true} onClick={() => setPep(true)} className={choice(pep === true)}><span className="text-[15px] font-semibold">Yes</span></button>
                <button type="button" aria-pressed={pep === false} onClick={() => setPep(false)} className={choice(pep === false)}><span className="text-[15px] font-semibold">No</span></button>
              </div>
              <p className="mt-5 text-[13px] font-medium text-sales-text-secondary">The registered owner is</p>
              <div className="mt-2 grid gap-2">
                <button type="button" aria-pressed={ownerKind === "person"} onClick={() => setOwnerKind("person")} className={choice(ownerKind === "person")}><span className="text-[15px] font-semibold">A person</span></button>
                <button type="button" aria-pressed={ownerKind === "company"} onClick={() => setOwnerKind("company")} className={choice(ownerKind === "company")}>
                  <span><span className="block text-[15px] font-semibold">A company</span><span className="mt-0.5 block text-[13px] text-sales-text-secondary">The next part asks for the company, its shareholders, and the documents.</span></span>
                </button>
              </div>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={back} className={lineBtn}>Back</button><button type="button" onClick={continueSeller} className={limeBtn}>Continue</button></div>
            </div>
          ) : null}

          {step === "work" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Work and funds</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">These are the lines under the seller’s name on the open mandate.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-sales-text-secondary">Occupation<input value={occupation} onChange={(event) => setOccupation(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Industry<input value={industry} onChange={(event) => setIndustry(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Position held<input value={position} onChange={(event) => setPosition(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Employer<input value={employer} onChange={(event) => setEmployer(event.target.value)} className={field} /></label>
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Employer name and address<input value={employerAddress} onChange={(event) => setEmployerAddress(event.target.value)} className={field} /></label>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Primary source of funds<input value={funds} onChange={(event) => setFunds(event.target.value)} className={field} /></label>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={back} className={lineBtn}>Back</button><button type="button" onClick={continueWork} className={limeBtn}>Continue</button></div>
            </div>
          ) : null}

          {step === "company" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">The company</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">List shareholders who own 10% or more. The documents stay with you. This sample does not take uploads.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-sales-text-secondary">Company name<input value={company} onChange={(event) => setCompany(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Industry<input value={companyIndustry} onChange={(event) => setCompanyIndustry(event.target.value)} className={field} /></label>
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Company address<input value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} className={field} /></label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-sales-text-secondary">Email<input value={companyEmail} onChange={(event) => setCompanyEmail(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Contact numbers<input value={companyPhone} onChange={(event) => setCompanyPhone(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Representative<input value={representative} onChange={(event) => setRepresentative(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Representative identity number<input value={representativeId} onChange={(event) => setRepresentativeId(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Position held<input value={representativeRole} onChange={(event) => setRepresentativeRole(event.target.value)} className={field} /></label>
                <label className="block text-[13px] font-medium text-sales-text-secondary">Representative cell<input value={representativePhone} onChange={(event) => setRepresentativePhone(event.target.value)} className={field} /></label>
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Representative contact address<input value={representativeAddress} onChange={(event) => setRepresentativeAddress(event.target.value)} className={field} /></label>
              <p className="mt-4 text-[13px] font-medium text-sales-text-secondary">Shareholders at 10% or more</p>
              <div className="mt-2 grid gap-2">
                {holders.map((holder, holderIndex) => (
                  <input key={holderIndex} aria-label={`Shareholder ${holderIndex + 1}`} value={holder} onChange={(event) => setHolders((current) => current.map((item, index) => index === holderIndex ? event.target.value : item))} className={field} />
                ))}
              </div>
              <div className="mt-4 grid gap-3">
                {([
                  ["directors", "Identity documents of the directors"],
                  ["resolution", "The company’s resolution to sell the property"],
                  ["holders", "Identity documents of shareholders who own 10% or more"],
                  ["cr16", "CR16 with the list of beneficial owners"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-start gap-3 text-[14px] leading-relaxed">
                    <input type="checkbox" checked={docs[key]} onChange={(event) => setDocs((current) => ({ ...current, [key]: event.target.checked }))} className="mt-1 h-4 w-4" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed">
                <input type="checkbox" checked={surety} onChange={(event) => setSurety(event.target.checked)} className="mt-1 h-4 w-4" />
                <span>I bind myself, jointly and severally, as surety for {company.trim() || "the company"}’s commission to Landlords Junction.</span>
              </label>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={back} className={lineBtn}>Back</button><button type="button" onClick={continueCompany} className={limeBtn}>Continue</button></div>
            </div>
          ) : null}

          {step === "terms" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">What you grant</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">This mandate does not stop you from instructing another agency.</p>
              <div className="mt-5 grid gap-2">
                {CLAUSES.map((clause) => {
                  const open = openClause === clause.id;
                  const detail = "detail" in clause ? clause.detail : null;
                  return (
                    <button key={clause.id} type="button" aria-expanded={detail ? open : undefined} onClick={() => detail && setOpenClause(open ? null : clause.id)} className="rounded-[10px] border border-sales-border bg-sales-bg px-4 py-3 text-left hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-[15px] font-semibold">{clause.title}</span>
                          <span className="mt-1 block text-[13px] leading-relaxed text-sales-text-secondary">{clause.summary}</span>
                        </span>
                        {detail ? <span className="shrink-0 text-[13px] font-semibold text-sales-text-muted">{open ? "Hide" : "Read"}</span> : null}
                      </span>
                      {detail && open ? <span className="mt-2 block text-[13px] leading-relaxed text-sales-text-secondary">{detail}</span> : null}
                    </button>
                  );
                })}
              </div>
              <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed">
                <input type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setError(null); }} className="mt-1 h-4 w-4" />
                <span>I grant Landlords Junction Properties this open mandate from {start || "the start date"} to {end || "the end date"}, and I agree to commission of 5% of the selling price plus VAT at 15.5% of that commission.</span>
              </label>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={back} className={lineBtn}>Back</button><button type="button" onClick={continueTerms} className={limeBtn}>Continue</button></div>
            </div>
          ) : null}

          {step === "sign" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Sign it</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">Signed at the place below on {SIGNED_ON}. The witness signs on this same screen. {NEGOTIATOR} is the sales negotiator.</p>
              <label className="mt-5 block text-[13px] font-medium text-sales-text-secondary">Signed at<input value={place} onChange={(event) => setPlace(event.target.value)} className={field} /></label>
              <div className="mt-4">
                <p className="text-[13px] font-medium text-sales-text-secondary">Signature of {sellerName || "the owner or representative"}</p>
                <div className="mt-1"><SignaturePad onChange={(value) => { setSignature(value); setError(null); }} /></div>
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">Witness<input value={witness} onChange={(event) => setWitness(event.target.value)} className={field} /></label>
              <div className="mt-4">
                <p className="text-[13px] font-medium text-sales-text-secondary">Witness signature</p>
                <div className="mt-1"><SignaturePad onChange={(value) => { setWitnessSign(value); setError(null); }} /></div>
              </div>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={back} className={lineBtn}>Back</button>
                <button type="button" disabled={sending} onClick={send} className={limeBtn}>{sending ? "Sending" : "Grant the mandate"}</button>
              </div>
            </div>
          ) : null}

          {step === "sent" ? (
            <div className="mt-5">
              <p className="text-[13px] font-medium text-sales-text-muted">Seller finished</p>
              <h2 className="mt-2 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">The open mandate is signed</h2>
              <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">
                {address.trim() || "The property"}. Open from {start} to {end}. The mandate price is US${grouped(price)}. {NEGOTIATOR} can generate a PDF for the seller.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPdf(true)} className={limeBtn}>Generate PDF</button>
                <button type="button" onClick={() => { setPdf(false); setStep("property"); }} className={lineBtn}>Start again</button>
              </div>
            </div>
          ) : null}
        </section>
      </div>}
    </div>
  );
}
