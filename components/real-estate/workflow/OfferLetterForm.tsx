"use client";

/* Public photos and logos are proxied bytes or arbitrary agency https URLs, so next/image host allowlists do not apply. */
/* eslint-disable @next/next/no-img-element */

import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { VIEWING_ACCENT, viewingAccentInk, type ViewingPropertyCard } from "@/lib/real-estate/workflow/viewing-form";
import { Photographs, type ViewingFormPreview } from "@/components/real-estate/workflow/ViewingRequestForm";
import styles from "./viewing-request-form.module.css";

export type OfferLetterPreview = ViewingFormPreview & {
  purpose?: string;
  brand?: ViewingFormPreview["brand"] & { contactEmail?: string | null };
  property?: ViewingPropertyCard;
  purchaser?: { name: string | null; phone: string | null; email: string | null } | null;
  offer?: {
    amount: number | null;
    currency: string | null;
    conditions: string | null;
    expiresAt: string | null;
    buyerName: string | null;
  } | null;
  error?: string;
};

const TITLES = ["Mr", "Mrs", "Miss", "Dr", "Prof", "Other"];
const MARITAL = ["Single", "Married", "Divorced", "Widowed", "Other"];

function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString()}`;
  }
}

function todayLabel(): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={wide ? styles.wide : undefined}>
      {label}
      {children}
    </label>
  );
}

export function OfferLetterForm({ token, preview }: { token: string; preview: OfferLetterPreview | null }) {
  const seller = preview?.purpose === "offer_seller";
  const brand = preview?.brand;
  const property = preview?.property;
  const agency = brand?.agencyName?.trim() || "Agency";
  const accent = brand?.accent && /^#[0-9a-fA-F]{6}$/.test(brand.accent) ? brand.accent : VIEWING_ACCENT;
  const tone = { "--accent": accent, "--accent-ink": viewingAccentInk(accent) } as CSSProperties;
  const negotiator = [brand?.contactName, brand?.contactPhone, brand?.contactEmail].filter(Boolean).join(" · ");
  const facts = [
    property?.categoryLabel ? { value: property.categoryLabel, label: "Type" } : null,
    property?.bedrooms != null ? { value: String(property.bedrooms), label: property.bedrooms === 1 ? "Bedroom" : "Bedrooms" } : null,
    property?.bathrooms != null ? { value: String(property.bathrooms), label: property.bathrooms === 1 ? "Bathroom" : "Bathrooms" } : null,
    property?.transactionLabel ? { value: property.transactionLabel, label: "Listing" } : null,
  ].filter((item): item is { value: string; label: string } => item != null);

  const [name, setName] = useState(preview?.purchaser?.name ?? "");
  const [amount, setAmount] = useState("");
  const [amountWords, setAmountWords] = useState("");
  const [payableOn, setPayableOn] = useState("");
  const [conditions, setConditions] = useState("");
  const [title, setTitle] = useState("");
  const [surname, setSurname] = useState("");
  const [givenName, setGivenName] = useState("");
  const [nationality, setNationality] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [industry, setIndustry] = useState("");
  const [position, setPosition] = useState("");
  const [cell, setCell] = useState(preview?.purchaser?.phone ?? "");
  const [employer, setEmployer] = useState("");
  const [email, setEmail] = useState(preview?.purchaser?.email ?? "");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [employerAddress, setEmployerAddress] = useState("");
  const [sourceOfFunds, setSourceOfFunds] = useState("");
  const [pep, setPep] = useState("");
  const [companyOffer, setCompanyOffer] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyIndustry, setCompanyIndustry] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyRepresentative, setCompanyRepresentative] = useState("");
  const [companyRepresentativeId, setCompanyRepresentativeId] = useState("");
  const [companyRepresentativePosition, setCompanyRepresentativePosition] = useState("");
  const [companyContactAddress, setCompanyContactAddress] = useState("");
  const [companyContactPhone, setCompanyContactPhone] = useState("");
  const [witness, setWitness] = useState("");
  const [signature, setSignature] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || sent) return;
    setResult(null);
    setFailed(false);
    if (!seller) {
      if (!name.trim()) {
        setFailed(true);
        setResult("Enter the purchaser's name.");
        return;
      }
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        setFailed(true);
        setResult("Enter the offer amount.");
        return;
      }
      if (amountWords.trim().length < 2) {
        setFailed(true);
        setResult("Write the amount in words.");
        return;
      }
      if (!payableOn) {
        setFailed(true);
        setResult("Choose the date the price is payable.");
        return;
      }
    }
    if (signature.trim().length < 2) {
      setFailed(true);
      setResult(seller ? "Sign to accept the offer." : "Sign the offer before sending it.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/public/journey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          seller
            ? { action: "seller_decision", decision: "accept", name, signature, witness }
            : {
                action: "sign_offer",
                name,
                signature,
                amount: Number(amount),
                conditions,
                letter: {
                  amountWords,
                  payableOn,
                  title,
                  surname,
                  givenName,
                  nationality,
                  identityNumber,
                  maritalStatus,
                  spouseName,
                  occupation,
                  industry,
                  position,
                  cell,
                  employer,
                  email,
                  residentialAddress,
                  employerAddress,
                  sourceOfFunds,
                  pep,
                  witness,
                  ...(companyOffer
                    ? {
                        companyName,
                        companyAddress,
                        companyIndustry,
                        companyEmail,
                        companyPhone,
                        companyRepresentative,
                        companyRepresentativeId,
                        companyRepresentativePosition,
                        companyContactAddress,
                        companyContactPhone,
                      }
                    : {}),
                },
              },
        ),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setFailed(!response.ok);
      if (!response.ok) {
        setResult(json.error ?? "The offer was not saved.");
        return;
      }
      setSent(true);
      setResult(seller ? "You have accepted this offer." : `${agency} has your signed offer. The seller reviews this copy.`);
    } finally {
      setPending(false);
    }
  }

  async function decline() {
    if (pending || sent) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/public/journey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller_decision", decision: "decline", name, signature: signature.trim() || "declined", witness }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setFailed(!response.ok);
      if (!response.ok) {
        setResult(json.error ?? "The offer was not declined.");
        return;
      }
      setSent(true);
      setResult("You have declined this offer.");
    } finally {
      setPending(false);
    }
  }

  const offer = preview?.offer;
  const knownAs = [property?.heading, property?.place].filter(Boolean).join(", ") || "this property";

  return (
    <main className={styles.page} style={tone}>
      <div className={styles.wrap}>
        <header className={styles.bar}>
          <div className={styles.brand}>
            {brand?.logoUrl ? <img className={styles.logo} src={brand.logoUrl} alt="" /> : <div className={styles.mark} aria-hidden="true">{agency.slice(0, 1).toUpperCase()}</div>}
            <div>
              <p className={styles.agency}>{preview ? agency : "Loading"}</p>
              {negotiator ? <p className={styles.agent}>{negotiator}</p> : null}
            </div>
          </div>
        </header>
        {!preview ? <p className={styles.lead}>Loading the offer letter.</p> : null}
        {preview?.error ? <p className={styles.alert} role="alert">{preview.error}</p> : null}
        {preview && !preview.error ? (
          <div className={styles.sheet}>
            <section className={styles.house} aria-label="The property">
              <p className={styles.kicker}>{seller ? "Seller's copy" : "Offer to purchase"}</p>
              <h1 className={styles.title}>{property?.heading ?? "Property"}</h1>
              {property?.place ? <p className={styles.suburb}>{property.place}</p> : null}
              {property?.priceLabel ? <p className={styles.price}><small>Asking price</small>{property.priceLabel}</p> : <p className={styles.price}>Price on request</p>}
              {facts.length ? (
                <ul className={styles.facts}>
                  {facts.map((item) => <li key={item.label}>{item.value}<span>{item.label}</span></li>)}
                </ul>
              ) : null}
              <Photographs urls={property?.photoUrls?.length ? property.photoUrls : property?.photoUrl ? [property.photoUrl] : []} heading={property?.heading ?? "this property"} />
              {property?.description ? <p className={styles.about}>{property.description}</p> : null}
              {preview.synthetic ? <p className={styles.practice}>This is a practice form until the agency approves its template.</p> : null}
            </section>
            <form className={styles.form} aria-label={seller ? "Seller's response" : "Offer to purchase"} onSubmit={(event) => void submit(event)}>
              <h2 className={styles.choice}>{seller ? "The purchaser's offer" : "Property offer to purchase"}</h2>
              <p className={styles.lead}>
                {seller
                  ? `${offer?.buyerName ?? "The purchaser"} offers to buy ${knownAs}. Accepting signs this revision.`
                  : `I/we offer to purchase the immovable property commonly known as ${knownAs}.`}
              </p>
              {seller ? (
                <div className={styles.terms}>
                  <span className={styles.section}>Offer sum</span>
                  <strong>{money(offer?.amount, offer?.currency)}</strong>
                  {offer?.conditions ? <p>{offer.conditions}</p> : null}
                  {offer?.expiresAt ? <p>Offer open until {new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(new Date(offer.expiresAt))}.</p> : null}
                </div>
              ) : (
                <>
                  <div className={styles.fields}>
                    <Field label="I/we" wide>
                      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Purchaser's full name" autoComplete="name" required />
                    </Field>
                    <Field label="For the sum of">
                      <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="185000" required />
                    </Field>
                    <Field label="In words" wide>
                      <input value={amountWords} onChange={(event) => setAmountWords(event.target.value)} placeholder="One hundred and eighty five thousand dollars" required />
                    </Field>
                    <Field label="Payable on or before" wide>
                      <input type="date" value={payableOn} onChange={(event) => setPayableOn(event.target.value)} required />
                    </Field>
                    <Field label="Subject to the following conditions" wide>
                      <textarea value={conditions} onChange={(event) => setConditions(event.target.value)} placeholder={"1. Bond approval\n2. Occupation date"} />
                    </Field>
                  </div>
                  <p className={styles.note}>This offer stays open for seven days after you sign. If the seller accepts it, it can become a binding agreement to buy this property.</p>
                  <p className={styles.section}>Purchaser&apos;s details</p>
                  <div className={styles.fields}>
                    <Field label="Title">
                      <select value={title} onChange={(event) => setTitle(event.target.value)}>
                        <option value="">Select</option>
                        {TITLES.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </Field>
                    <Field label="Surname"><input value={surname} onChange={(event) => setSurname(event.target.value)} autoComplete="family-name" /></Field>
                    <Field label="Name"><input value={givenName} onChange={(event) => setGivenName(event.target.value)} autoComplete="given-name" /></Field>
                    <Field label="Nationality"><input value={nationality} onChange={(event) => setNationality(event.target.value)} /></Field>
                    <Field label="Identity number"><input value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value)} /></Field>
                    <Field label="Marital status">
                      <select value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value)}>
                        <option value="">Select</option>
                        {MARITAL.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </Field>
                    <Field label="Name of spouse"><input value={spouseName} onChange={(event) => setSpouseName(event.target.value)} /></Field>
                    <Field label="Occupation"><input value={occupation} onChange={(event) => setOccupation(event.target.value)} /></Field>
                    <Field label="Industry"><input value={industry} onChange={(event) => setIndustry(event.target.value)} /></Field>
                    <Field label="Position held"><input value={position} onChange={(event) => setPosition(event.target.value)} /></Field>
                    <Field label="Cell"><input value={cell} onChange={(event) => setCell(event.target.value)} autoComplete="tel" inputMode="tel" /></Field>
                    <Field label="Employer"><input value={employer} onChange={(event) => setEmployer(event.target.value)} /></Field>
                    <Field label="Email"><input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" /></Field>
                    <Field label="Present residential address" wide><input value={residentialAddress} onChange={(event) => setResidentialAddress(event.target.value)} autoComplete="street-address" /></Field>
                    <Field label="Employer name and address" wide><input value={employerAddress} onChange={(event) => setEmployerAddress(event.target.value)} /></Field>
                    <Field label="Primary source of funds" wide><input value={sourceOfFunds} onChange={(event) => setSourceOfFunds(event.target.value)} /></Field>
                  </div>
                  <fieldset className={styles.wide}>
                    <legend className={styles.section}>Are you a politically exposed person?</legend>
                    <div className={styles.choiceRow}>
                      <label><input type="radio" name="pep" value="no" checked={pep === "no"} onChange={() => setPep("no")} /> No</label>
                      <label><input type="radio" name="pep" value="yes" checked={pep === "yes"} onChange={() => setPep("yes")} /> Yes</label>
                    </div>
                  </fieldset>
                  <label className={styles.tick}>
                    <input type="checkbox" checked={companyOffer} onChange={(event) => setCompanyOffer(event.target.checked)} />
                    This offer is made by a company
                  </label>
                  {companyOffer ? (
                    <div className={styles.fields}>
                      <Field label="Company name"><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></Field>
                      <Field label="Company address"><input value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} /></Field>
                      <Field label="Nature of business"><input value={companyIndustry} onChange={(event) => setCompanyIndustry(event.target.value)} /></Field>
                      <Field label="Company email"><input value={companyEmail} onChange={(event) => setCompanyEmail(event.target.value)} inputMode="email" /></Field>
                      <Field label="Company phone"><input value={companyPhone} onChange={(event) => setCompanyPhone(event.target.value)} inputMode="tel" /></Field>
                      <Field label="Representative"><input value={companyRepresentative} onChange={(event) => setCompanyRepresentative(event.target.value)} /></Field>
                      <Field label="Representative identity number"><input value={companyRepresentativeId} onChange={(event) => setCompanyRepresentativeId(event.target.value)} /></Field>
                      <Field label="Position held"><input value={companyRepresentativePosition} onChange={(event) => setCompanyRepresentativePosition(event.target.value)} /></Field>
                      <Field label="Representative address" wide><input value={companyContactAddress} onChange={(event) => setCompanyContactAddress(event.target.value)} /></Field>
                      <Field label="Representative phone"><input value={companyContactPhone} onChange={(event) => setCompanyContactPhone(event.target.value)} inputMode="tel" /></Field>
                    </div>
                  ) : null}
                </>
              )}
              {sent ? null : (
                <div className={styles.fields}>
                  {seller ? <Field label="Your name" wide><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seller's name" autoComplete="name" required /></Field> : null}
                  <Field label="Witness"><input value={witness} onChange={(event) => setWitness(event.target.value)} placeholder="Witness name" /></Field>
                  <Field label={seller ? "Date accepted" : "Date offered"}><input value={todayLabel()} readOnly /></Field>
                  <Field label={seller ? "Seller signature" : "Purchaser signature"} wide>
                    <span className={styles.sign}><input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="Sign your name" required /></span>
                  </Field>
                </div>
              )}
              {negotiator ? <p className={styles.note}>Sales negotiator: {brand?.contactName}</p> : null}
              {sent ? null : <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Sending" : seller ? "Accept and sign" : "Sign offer"}</button>}
              {seller && !sent ? <button className={styles.secondary} type="button" disabled={pending} onClick={() => void decline()}>Decline</button> : null}
              {result ? <p className={failed ? styles.alert : styles.status} role={failed ? "alert" : "status"}>{result}</p> : null}
              <p className={styles.foot}>Prepared with SegmiQ for {agency}.</p>
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
