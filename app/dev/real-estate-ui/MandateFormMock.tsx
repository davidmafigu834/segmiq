"use client";

import { useState } from "react";
import { SignaturePad } from "@/components/real-estate/workflow/SignaturePad";
import { SellerPdf, SoleMandatePdf } from "@/components/real-estate/seller-intake/MandatePaper";

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4
 * Genre: modern-minimal · macrostructure: Workbench · design.md
 * Audience: a seller who opened an agent link
 * Use: grant a sole mandate
 * Theme: locked sales tokens, lime only on the primary action
 */

const SIGNED_ON = "12 November 2026";
const NEGOTIATOR = "Nyasha Moyo";

const CLAUSES = [
  {
    id: "find",
    title: "Find a buyer",
    summary: "The agency looks for a buyer at your asking price, or at a lower price you later authorise.",
  },
  {
    id: "sole",
    title: "Sole for two months",
    summary: "For at least two months, Landlords Junction is the only agency that may sell the property. After that, the mandate continues until you vary it in writing.",
    detail: "During those two months no sale is concluded through another agent, through you, or through anyone acting for you. After the two months you may, in writing, allow other agents to be instructed.",
  },
  {
    id: "intro",
    title: "Buyers the agency introduced",
    summary: "If the property is sold to someone the agency introduced, the commission is still due, before or after the two months, and whoever concludes the sale.",
  },
  {
    id: "fee",
    title: "5% plus VAT",
    summary: "Commission is 5% of the selling price, plus VAT at 15.5% on that commission.",
    detail: "This is the scale recommended by the Real Estate Institute of Zimbabwe. It is higher than the statutory minimum, and the Estate Agents Council permits it under Statutory Instrument 89 of 2016.",
  },
  {
    id: "ads",
    title: "Advertising and a sold board",
    summary: "The agency may advertise the property on social media, and may leave a sold board on it for up to two months after a sale.",
  },
] as const;

type Step = "property" | "price" | "who" | "terms" | "sign" | "sent";
type OwnerKind = "person" | "company";
type SignerKind = "owner" | "authorised";

const STEPS: Step[] = ["property", "price", "who", "terms", "sign"];
const STEP_LABEL = ["The property", "The price", "Who signs", "The mandate", "Sign"];

const field = "mt-1 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[15px] text-sales-text-primary placeholder:text-sales-text-muted focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";
const choice = (on: boolean) =>
  `flex min-h-14 items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${
    on ? "border-sales-text-primary bg-sales-surface-active" : "border-sales-border bg-sales-bg hover:bg-sales-surface-hover"
  }`;

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

export function MandateFormMock({ onBack }: { onBack?: () => void }) {
  const [step, setStep] = useState<Step>("property");
  const [address, setAddress] = useState("");
  const [owner, setOwner] = useState("");
  const [home, setHome] = useState("");
  const [mobile, setMobile] = useState("");
  const [price, setPrice] = useState("");
  const [ownerKind, setOwnerKind] = useState<OwnerKind>("person");
  const [signerKind, setSignerKind] = useState<SignerKind>("owner");
  const [signer, setSigner] = useState("");
  const [authority, setAuthority] = useState("");
  const [surety, setSurety] = useState(false);
  const [openClause, setOpenClause] = useState<string | null>("sole");
  const [agreed, setAgreed] = useState(false);
  const [place, setPlace] = useState("Bulawayo");
  const [signature, setSignature] = useState("");
  const [witness, setWitness] = useState("");
  const [witnessSign, setWitnessSign] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pdf, setPdf] = useState(false);

  const index = Math.max(0, STEPS.indexOf(step));
  const quote = commissionOf(price);
  const signingAsOwner = ownerKind === "person" && signerKind === "owner";
  const signatory = signingAsOwner ? owner.trim() : signer.trim();

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function continueProperty() {
    if (address.trim().length < 4) {
      setError("Enter the property address.");
      return;
    }
    if (owner.trim().length < 2) {
      setError("Enter the registered owner.");
      return;
    }
    if (home.trim().length < 4) {
      setError("Enter the owner’s residential address.");
      return;
    }
    if (mobile.replace(/\D/g, "").length < 9) {
      setError("Enter a mobile number the agency can use.");
      return;
    }
    go("price");
  }

  function continuePrice() {
    if (!quote) {
      setError("Enter the asking price before commission.");
      return;
    }
    go("who");
  }

  function continueWho() {
    if (!signingAsOwner && signer.trim().length < 2) {
      setError("Enter the name of the person signing.");
      return;
    }
    if (!signingAsOwner && authority.trim().length < 2) {
      setError("Say how this person is authorised to sign.");
      return;
    }
    if (ownerKind === "company" && !surety) {
      setError("A company owner needs the signatory to accept the surety.");
      return;
    }
    go("terms");
  }

  function continueTerms() {
    if (!agreed) {
      setError("Read the mandate and confirm you grant it.");
      return;
    }
    go("sign");
  }

  function send() {
    if (place.trim().length < 2) {
      setError("Enter the place where this is signed.");
      return;
    }
    if (!signature) {
      setError("The owner or representative draws their signature.");
      return;
    }
    if (witness.trim().length < 2) {
      setError("Enter the witness’s name.");
      return;
    }
    if (!witnessSign) {
      setError("The witness draws their signature on this screen.");
      return;
    }
    setError(null);
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setStep("sent");
    }, 700);
  }

  function reset() {
    setStep("property");
    setAddress("");
    setOwner("");
    setHome("");
    setMobile("");
    setPrice("");
    setOwnerKind("person");
    setSignerKind("owner");
    setSigner("");
    setAuthority("");
    setSurety(false);
    setOpenClause("sole");
    setAgreed(false);
    setPlace("Bulawayo");
    setSignature("");
    setWitness("");
    setWitnessSign("");
    setError(null);
    setSending(false);
    setPdf(false);
  }

  return (
    <div className="re-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3">
        <p className="text-[13px] text-sales-text-secondary">Sample of the link a seller opens. The answers and the signatures stay on this page. Nothing is filed.</p>
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
            Choose another mandate
          </button>
        ) : null}
      </div>

      {step === "sent" && pdf ? (
        <SellerPdf
          heading="Sole mandate"
          detail="Generated from the answers the seller entered. Give this copy to the seller, or go back to the file."
          onBack={() => setPdf(false)}
        >
          <SoleMandatePdf
            data={{
              address,
              owner,
              home,
              mobile,
              price,
              ownerKind,
              signerKind,
              signer,
              authority,
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
            <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">Sole mandate</h1>
            <p className="mt-2 text-[15px] text-sales-text-secondary">{address.trim() || "Property address"}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-5">
            <div>
              <dt className="text-[12px] text-sales-text-muted">Registered owner</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">{owner.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-sales-text-muted">Asking price</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">{price ? `US$${grouped(price)}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-sales-text-muted">Sole period</dt>
              <dd className="mt-0.5 text-[16px] font-semibold">Two months</dd>
            </div>
            <div>
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
              <p className="text-[13px] font-medium text-sales-text-muted">Part {index + 1} of 5 · {STEP_LABEL[index]}</p>
              <div className="mt-3 flex items-center gap-2" aria-hidden>
                {STEPS.map((item, itemIndex) => (
                  <span key={item} className={`h-1.5 flex-1 rounded-full ${itemIndex <= index ? "bg-sales-text-primary" : "bg-sales-border-subtle"}`} />
                ))}
              </div>
            </div>
          ) : null}

          {step === "property" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Confirm the property</h2>
              <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-sales-text-secondary">Enter the property this mandate covers. The address is blank until you type it.</p>
              <label className="mt-5 block text-[13px] font-medium text-sales-text-secondary">
                Property address
                <input value={address} onChange={(event) => { setAddress(event.target.value); setError(null); }} className={field} />
              </label>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                Registered owner
                <input value={owner} autoComplete="organization" onChange={(event) => { setOwner(event.target.value); setError(null); }} className={field} />
              </label>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                Owner’s residential address
                <input value={home} autoComplete="street-address" onChange={(event) => { setHome(event.target.value); setError(null); }} className={field} />
              </label>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                Mobile number
                <input value={mobile} inputMode="tel" autoComplete="tel" placeholder="077 000 0000" onChange={(event) => { setMobile(event.target.value); setError(null); }} className={field} />
              </label>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <button type="button" onClick={continueProperty} className="mt-5 inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
                Continue
              </button>
            </div>
          ) : null}

          {step === "price" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Asking price</h2>
              <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-sales-text-secondary">This is the price before commission. Commission is worked out on the selling price, which can be lower if you later authorise it.</p>
              <label className="mt-5 block text-[13px] font-medium text-sales-text-secondary">
                Asking price, before commission
                <span className="mt-1 flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-bg focus-within:shadow-[var(--sales-focus-ring)]">
                  <span className="pl-3 text-[15px] font-semibold text-sales-text-primary">US$</span>
                  <input
                    value={grouped(price)}
                    inputMode="numeric"
                    aria-label="Asking price in US dollars"
                    onChange={(event) => { setPrice(digitsOnly(event.target.value)); setError(null); }}
                    className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] text-sales-text-primary outline-none"
                  />
                </span>
              </label>
              {quote ? (
                <div className="mt-4 rounded-[10px] border border-sales-border bg-sales-bg px-4 py-3">
                  <p className="text-[13px] font-medium text-sales-text-secondary">If it sells at this asking price</p>
                  <dl className="mt-3 space-y-2 text-[14px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-sales-text-secondary">Commission, 5%</dt>
                      <dd className="font-semibold tabular-nums">{moneyFromCents(quote.fee)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-sales-text-secondary">VAT, 15.5% of the commission</dt>
                      <dd className="font-semibold tabular-nums">{moneyFromCents(quote.vat)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-t border-sales-border-subtle pt-2">
                      <dt className="font-semibold">Together</dt>
                      <dd className="font-semibold tabular-nums">{moneyFromCents(quote.total)}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => go("property")} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">Back</button>
                <button type="button" onClick={continuePrice} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">Continue</button>
              </div>
            </div>
          ) : null}

          {step === "who" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Who is signing</h2>
              <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-sales-text-secondary">Say if you are the owner, or if you are signing for the owner.</p>
              <p className="mt-5 text-[13px] font-medium text-sales-text-secondary">The registered owner is</p>
              <div className="mt-2 grid gap-2">
                <button type="button" aria-pressed={ownerKind === "person"} onClick={() => { setOwnerKind("person"); setSignerKind("owner"); setSurety(false); setError(null); }} className={choice(ownerKind === "person")}>
                  <span className="text-[15px] font-semibold">A person</span>
                  <span className="text-[13px] font-semibold text-sales-text-muted">{ownerKind === "person" ? "Selected" : "Choose"}</span>
                </button>
                <button type="button" aria-pressed={ownerKind === "company"} onClick={() => { setOwnerKind("company"); setSignerKind("authorised"); setError(null); }} className={choice(ownerKind === "company")}>
                  <span>
                    <span className="block text-[15px] font-semibold">A company</span>
                    <span className="mt-0.5 block text-[13px] text-sales-text-secondary">The person who signs also stands surety for the commission.</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-sales-text-muted">{ownerKind === "company" ? "Selected" : "Choose"}</span>
                </button>
              </div>
              {ownerKind === "person" ? (
                <div className="mt-4 grid gap-2">
                  <button type="button" aria-pressed={signerKind === "owner"} onClick={() => { setSignerKind("owner"); setError(null); }} className={choice(signerKind === "owner")}>
                    <span className="text-[15px] font-semibold">I am the registered owner</span>
                    <span className="text-[13px] font-semibold text-sales-text-muted">{signerKind === "owner" ? "Selected" : "Choose"}</span>
                  </button>
                  <button type="button" aria-pressed={signerKind === "authorised"} onClick={() => { setSignerKind("authorised"); setError(null); }} className={choice(signerKind === "authorised")}>
                    <span className="text-[15px] font-semibold">I am authorised to sign for the owner</span>
                    <span className="text-[13px] font-semibold text-sales-text-muted">{signerKind === "authorised" ? "Selected" : "Choose"}</span>
                  </button>
                </div>
              ) : null}
              {signingAsOwner ? null : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-[13px] font-medium text-sales-text-secondary">
                    Name of the person signing
                    <input value={signer} onChange={(event) => { setSigner(event.target.value); setError(null); }} className={field} />
                  </label>
                  <label className="block text-[13px] font-medium text-sales-text-secondary">
                    How they are authorised
                    <input value={authority} placeholder="Director, executor, power of attorney" onChange={(event) => { setAuthority(event.target.value); setError(null); }} className={field} />
                  </label>
                </div>
              )}
              {ownerKind === "company" ? (
                <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed">
                  <input type="checkbox" checked={surety} onChange={(event) => { setSurety(event.target.checked); setError(null); }} className="mt-1 h-4 w-4 accent-[var(--sales-text-primary)]" />
                  <span>I bind myself, jointly and severally, as surety for {owner.trim() || "the company"}’s commission to Landlords Junction.</span>
                </label>
              ) : null}
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => go("price")} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">Back</button>
                <button type="button" onClick={continueWho} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">Continue</button>
              </div>
            </div>
          ) : null}

          {step === "terms" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">What you grant</h2>
              <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-sales-text-secondary">Open a line if you want the longer wording. The short line is the obligation.</p>
              <div className="mt-5 grid gap-2">
                {CLAUSES.map((clause) => {
                  const open = openClause === clause.id;
                  const detail = "detail" in clause ? clause.detail : null;
                  return (
                    <button
                      key={clause.id}
                      type="button"
                      aria-expanded={detail ? open : undefined}
                      onClick={() => detail && setOpenClause(open ? null : clause.id)}
                      className="rounded-[10px] border border-sales-border bg-sales-bg px-4 py-3 text-left transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
                    >
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
                <input type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setError(null); }} className="mt-1 h-4 w-4 accent-[var(--sales-text-primary)]" />
                <span>I grant Landlords Junction Properties the sole mandate for at least two months, and I agree to commission of 5% of the selling price plus VAT at 15.5%.</span>
              </label>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => go("who")} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">Back</button>
                <button type="button" onClick={continueTerms} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">Continue</button>
              </div>
            </div>
          ) : null}

          {step === "sign" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Sign it</h2>
              <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-sales-text-secondary">Signed at the place below on {SIGNED_ON}. The witness is with you and signs on this same screen. {NEGOTIATOR} is already the sales negotiator.</p>
              <label className="mt-5 block text-[13px] font-medium text-sales-text-secondary">
                Signed at
                <input value={place} onChange={(event) => { setPlace(event.target.value); setError(null); }} className={field} />
              </label>
              <div className="mt-4">
                <p className="text-[13px] font-medium text-sales-text-secondary">Signature of {signatory || "the owner or representative"}</p>
                <div className="mt-1">
                  <SignaturePad onChange={(value) => { setSignature(value); setError(null); }} />
                </div>
              </div>
              <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                Witness
                <input value={witness} onChange={(event) => { setWitness(event.target.value); setError(null); }} className={field} />
              </label>
              <div className="mt-4">
                <p className="text-[13px] font-medium text-sales-text-secondary">Witness signature</p>
                <div className="mt-1">
                  <SignaturePad onChange={(value) => { setWitnessSign(value); setError(null); }} />
                </div>
              </div>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => go("terms")} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">Back</button>
                <button type="button" disabled={sending} onClick={send} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60">
                  {sending ? "Sending" : "Grant the mandate"}
                </button>
              </div>
            </div>
          ) : null}

          {step === "sent" ? (
            <div className="mt-5">
              <p className="text-[13px] font-medium text-sales-text-muted">Seller finished</p>
              <h2 className="mt-2 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">The sole mandate is signed</h2>
              <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-sales-text-secondary">
                {address.trim()}. Sole from {SIGNED_ON} for at least two months. The asking price on the file is US${grouped(price)}. {NEGOTIATOR} can generate a PDF for the seller.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPdf(true)} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
                  Generate PDF
                </button>
                <button type="button" onClick={reset} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
                  Start again
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>}
    </div>
  );
}
