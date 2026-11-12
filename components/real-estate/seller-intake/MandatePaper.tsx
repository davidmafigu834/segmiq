"use client";

import { useState, type ReactNode } from "react";

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * Genre: modern-minimal · a paper the agent hands the seller
 * Theme: locked sales tokens. Lime only on Give to the seller.
 */

const SIGNED_ON = "12 November 2026";
const NEGOTIATOR = "Nyasha Moyo";

export type PaperBrand = {
  name: string;
  address?: string;
  phones?: string;
  directors?: string;
  negotiator?: string;
  signedOn?: string;
};

const MOCK_BRAND: PaperBrand = {
  name: "Landlords Junction Properties",
  address: "801B LAPF House, 8th Avenue and Jason Moyo, Bulawayo",
  phones: "+263 77 735 2802 · +263 78 148 7621 · +263 77 101 8382",
  directors: "Directors Austine Moyo, Aglow Moyo and Simon Moyo.",
  negotiator: NEGOTIATOR,
  signedOn: SIGNED_ON,
};

function brandOf(brand?: PaperBrand): PaperBrand {
  return brand ?? MOCK_BRAND;
}

const lineBtn = "inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";
const limeBtn = "inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60";

export type SolePdfData = {
  address: string;
  owner: string;
  home: string;
  mobile: string;
  price: string;
  ownerKind: "person" | "company";
  signerKind: "owner" | "authorised";
  signer: string;
  authority: string;
  surety: boolean;
  place: string;
  signature: string;
  witness: string;
  witnessSign: string;
};

export type OpenPdfData = {
  address: string;
  owner: string;
  category: string;
  rights: string;
  deed: string;
  description: string;
  occupation: string;
  start: string;
  end: string;
  price: string;
  words: string;
  payment: string;
  asking: string;
  seller: string;
  nationality: string;
  identity: string;
  marital: string;
  spouse: string;
  cell: string;
  email: string;
  home: string;
  pep: string;
  occupationJob: string;
  industry: string;
  position: string;
  employer: string;
  employerAddress: string;
  funds: string;
  company: string | null;
  companyAddress: string;
  companyIndustry: string;
  companyEmail: string;
  companyPhone: string;
  representative: string;
  representativeId: string;
  representativeRole: string;
  representativeAddress: string;
  representativePhone: string;
  holders: string[];
  documents: string[];
  surety: boolean;
  place: string;
  signature: string;
  witness: string;
  witnessSign: string;
};

function money(cents: number) {
  const whole = cents % 100 === 0;
  return `US$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function commission(digits: string) {
  const price = Number(digits);
  if (!Number.isFinite(price) || price <= 0) return null;
  const priceCents = Math.round(price * 100);
  const fee = Math.round((priceCents * 5) / 100);
  const vat = Math.round((fee * 155) / 1000);
  return { price: money(priceCents), fee: money(fee), vat: money(vat), total: money(fee + vat) };
}

function writtenDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso.trim();
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function Sheet({ page, pages, brand, children }: { page: number; pages: number; brand?: PaperBrand; children: ReactNode }) {
  const heading = brandOf(brand);
  return (
    <article className="mx-auto w-full max-w-[720px] border border-sales-border bg-sales-surface px-5 py-7 text-sales-text-primary sm:px-10 sm:py-9">
      <header className="flex items-start justify-between gap-4 border-b-2 border-sales-text-primary pb-4">
        <div className="min-w-0">
          <p className="font-display text-[18px] font-semibold leading-none tracking-[-0.03em]">{heading.name}</p>
          {heading.address ? <p className="mt-2 text-[12px] leading-relaxed text-sales-text-secondary">{heading.address}</p> : null}
          {heading.phones ? <p className="mt-1 text-[12px] text-sales-text-secondary">{heading.phones}</p> : null}
        </div>
        <p className="shrink-0 text-[12px] font-medium text-sales-text-muted">
          {page} / {pages}
        </p>
      </header>
      {children}
      {heading.directors || heading.negotiator ? (
        <footer className="mt-8 border-t border-sales-border-subtle pt-3 text-[12px] leading-relaxed text-sales-text-muted">
          {[heading.directors, heading.negotiator ? `Sales negotiator ${heading.negotiator}.` : ""].filter(Boolean).join(" ")}
        </footer>
      ) : null}
    </article>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[12px] text-sales-text-muted">{label}</dt>
      <dd className="mt-1 min-h-6 border-b border-sales-border pb-1.5 text-[15px] font-semibold leading-snug">{value.trim() || "—"}</dd>
    </div>
  );
}

function Clause({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2">
      <span className="font-semibold tabular-nums">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function Mark({ label, name, src, note }: { label: string; name: string; src?: string; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-sales-text-muted">{label}</p>
      <div className="mt-2 flex h-16 items-end border-b border-sales-text-primary bg-white">
        {src ? <img src={src} alt="" className="max-h-14 w-auto object-contain object-left" /> : null}
      </div>
      <p className="mt-1.5 text-[14px] font-semibold">{name.trim() || "—"}</p>
      {note ? <p className="mt-0.5 text-[12px] leading-relaxed text-sales-text-secondary">{note}</p> : null}
    </div>
  );
}

function Fee({ digits }: { digits: string }) {
  const quote = commission(digits);
  if (!quote) return null;
  return (
    <div className="mt-5">
      <p className="text-[12px] text-sales-text-muted">If it sells at the price on this page</p>
      <div className="mt-2 grid grid-cols-3 border border-sales-border">
        {[
          ["Commission, 5%", quote.fee],
          ["VAT, 15.5% of the commission", quote.vat],
          ["Together", quote.total],
        ].map(([label, amount], index) => (
          <div key={label} className={`px-3 py-3 ${index < 2 ? "border-r border-sales-border" : ""}`}>
            <p className="text-[12px] leading-snug text-sales-text-secondary">{label}</p>
            <p className="mt-1 font-display text-[16px] font-semibold tabular-nums sm:text-[18px]">{amount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Signs({
  signLabel,
  signName,
  signature,
  witness,
  witnessSign,
  place,
  brand,
}: {
  signLabel: string;
  signName: string;
  signature: string;
  witness: string;
  witnessSign: string;
  place: string;
  brand?: PaperBrand;
}) {
  const heading = brandOf(brand);
  const when = heading.signedOn || SIGNED_ON;
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-3">
      <Mark label={signLabel} name={signName} src={signature} note={`Signed at ${place.trim() || "—"} on ${when}`} />
      <Mark label="Witness" name={witness} src={witnessSign} />
      <Mark label="Sales negotiator" name={heading.negotiator || heading.name} note={heading.negotiator ? `For ${heading.name}` : heading.name} />
    </div>
  );
}

export function SellerPdf({ heading, detail, onBack, children }: { heading: string; detail: string; onBack: () => void; children: ReactNode }) {
  const [handed, setHanded] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">For the seller</p>
          <h2 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{heading}</h2>
          <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-sales-text-secondary">
            {handed ? "Hand this copy to the seller. It records what they signed." : detail}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onBack} className={lineBtn}>
            Back to the file
          </button>
          <button type="button" disabled={handed} onClick={() => setHanded(true)} className={limeBtn}>
            {handed ? "Given to the seller" : "Give to the seller"}
          </button>
        </div>
      </div>
      <div className="space-y-6 rounded-[12px] border border-sales-border bg-sales-bg p-3 sm:p-6">{children}</div>
    </div>
  );
}

export function SoleMandatePdf({ data, brand }: { data: SolePdfData; brand?: PaperBrand }) {
  const heading = brandOf(brand);
  const quote = commission(data.price);
  const asOwner = data.ownerKind === "person" && data.signerKind === "owner";
  const signName = asOwner ? data.owner : data.signer;
  const signLabel = asOwner ? "Registered owner" : "Authorised to sign";
  const when = heading.signedOn || SIGNED_ON;
  return (
    <Sheet page={1} pages={1} brand={heading}>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-display text-[28px] font-semibold leading-none tracking-[-0.03em]">Sole mandate</h3>
        <p className="text-[13px] font-medium">{when}</p>
      </div>
      <p className="mt-3 max-w-[58ch] text-[13px] leading-relaxed text-sales-text-secondary">
        The owner appoints {heading.name} as the only agency that may sell this property for at least two months.
      </p>
      <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Fact label="Property address" value={data.address} wide />
        <Fact label="Registered owner" value={data.owner} />
        <Fact label="Asking price, before commission" value={quote?.price ?? ""} />
        <Fact label="Owner’s residential address" value={data.home} />
        <Fact label="Mobile" value={data.mobile} />
        {!asOwner ? <Fact label="Person signing" value={data.signer} /> : null}
        {!asOwner ? <Fact label="How they are authorised" value={data.authority} wide /> : null}
      </dl>
      <Fee digits={data.price} />
      <ol className="mt-6 space-y-3 text-[13px] leading-relaxed">
        <Clause n={1}>The agency looks for a buyer at the asking price, or at a lower price the owner later authorises.</Clause>
        <Clause n={2}>
          For at least two months from {when}, no sale is concluded through another agent, through the owner, or through anyone acting for the owner. After that, the owner may allow other agents in writing. The mandate continues until it is varied in writing.
        </Clause>
        <Clause n={3}>If the property is sold to a person the agency introduced, the commission is still due, before or after the two months, and whoever concludes the sale.</Clause>
        <Clause n={4}>
          Commission is 5% of the selling price, plus VAT at 15.5% of that commission. This is the scale recommended by the Real Estate Institute of Zimbabwe. It is higher than the statutory minimum, and the Estate Agents Council permits it under Statutory Instrument 89 of 2016.
        </Clause>
        <Clause n={5}>The agency may advertise the property on social media, and may leave a sold board on it for up to two months after a sale.</Clause>
        {data.ownerKind === "company" && data.surety ? (
          <Clause n={6}>The signatory binds themselves, jointly and severally, as surety for the company’s commission to {heading.name}.</Clause>
        ) : null}
      </ol>
      <Signs signLabel={signLabel} signName={signName} signature={data.signature} witness={data.witness} witnessSign={data.witnessSign} place={data.place} brand={heading} />
    </Sheet>
  );
}

export function OpenMandatePdf({ data, brand }: { data: OpenPdfData; brand?: PaperBrand }) {
  const heading = brandOf(brand);
  const quote = commission(data.price);
  const asking = commission(data.asking);
  const holders = data.holders.map((item) => item.trim()).filter(Boolean);
  return (
    <>
      <Sheet page={1} pages={2} brand={heading}>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-display text-[28px] font-semibold leading-none tracking-[-0.03em]">Open mandate to sell</h3>
          <p className="text-[13px] font-medium">{writtenDate(data.start) || heading.signedOn || SIGNED_ON}</p>
        </div>
        <p className="mt-3 max-w-[58ch] text-[13px] leading-relaxed text-sales-text-secondary">
          This appointment does not stop the owner from instructing another agency. It runs from {writtenDate(data.start) || "—"} to {writtenDate(data.end) || "—"}.
        </p>
        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Fact label="Property address" value={data.address} wide />
          <Fact label="Registered owner" value={data.owner} />
          <Fact label="Category" value={data.category} />
          <Fact label="Property rights" value={data.rights} />
          <Fact label="Title deed or share certificate" value={data.deed} />
          <Fact label="Description" value={data.description} wide />
          <Fact label="Occupation" value={data.occupation} wide />
          <Fact label="Mandate price" value={quote ? `${quote.price}${data.words.trim() ? ` — ${data.words.trim()}` : ""}` : data.words} wide />
          <Fact label="Preferred payment" value={data.payment} />
          <Fact label="Asking price, before commission" value={asking?.price ?? ""} />
        </dl>
        <Fee digits={data.price} />
        <ol className="mt-6 space-y-3 text-[13px] leading-relaxed">
          <Clause n={1}>The agency looks for a buyer at the mandate price, or at a lower price the owner later authorises.</Clause>
          <Clause n={2}>The appointment runs from {writtenDate(data.start) || "the start date"} to {writtenDate(data.end) || "the end date"}. It does not make {heading.name} the only agency.</Clause>
          <Clause n={3}>
            Commission is 5% of the selling price, plus VAT at 15.5% of that commission. The VAT is of the commission, not of the selling price. The Real Estate Agents Council permits this under the Professional Conduct Amendment Rules, 2016 (No. 6).
          </Clause>
          <Clause n={4}>The agency may advertise the property on social media, and may put up a board after the sale saying they sold it.</Clause>
        </ol>
      </Sheet>
      <Sheet page={2} pages={2} brand={heading}>
        <h3 className="mt-6 font-display text-[22px] font-semibold leading-none tracking-[-0.03em]">Seller</h3>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Fact label="Name" value={data.seller} />
          <Fact label="Nationality" value={data.nationality} />
          <Fact label="Identity number" value={data.identity} />
          <Fact label="Marital status" value={data.marital === "Married" && data.spouse.trim() ? `Married, spouse ${data.spouse.trim()}` : data.marital} />
          <Fact label="Cell" value={data.cell} />
          <Fact label="Email" value={data.email} />
          <Fact label="Present residential address" value={data.home} wide />
          <Fact label="Politically exposed person" value={data.pep} />
          <Fact label="Occupation" value={data.occupationJob} />
          <Fact label="Industry" value={data.industry} />
          <Fact label="Position" value={data.position} />
          <Fact label="Employer" value={data.employer} />
          <Fact label="Employer name and address" value={data.employerAddress} wide />
          <Fact label="Primary source of funds" value={data.funds} wide />
        </dl>
        {data.company ? (
          <div className="mt-8">
            <h3 className="font-display text-[22px] font-semibold leading-none tracking-[-0.03em]">Company</h3>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Fact label="Company" value={data.company} />
              <Fact label="Industry" value={data.companyIndustry} />
              <Fact label="Address" value={data.companyAddress} wide />
              <Fact label="Email" value={data.companyEmail} />
              <Fact label="Contact numbers" value={data.companyPhone} />
              <Fact label="Representative" value={data.representative} />
              <Fact label="Representative identity number" value={data.representativeId} />
              <Fact label="Position held" value={data.representativeRole} />
              <Fact label="Representative cell" value={data.representativePhone} />
              <Fact label="Representative contact address" value={data.representativeAddress} wide />
              <Fact label="Shareholders at 10% or more" value={holders.join(", ")} wide />
              <Fact label="Documents the seller holds" value={data.documents.join("; ")} wide />
            </dl>
            {data.surety ? (
              <p className="mt-4 text-[13px] leading-relaxed">The representative binds themselves, jointly and severally, as surety for {data.company.trim() || "the company"}’s commission to {heading.name}.</p>
            ) : null}
          </div>
        ) : null}
        <Signs
          signLabel={data.company ? "Representative" : "Seller"}
          signName={data.company ? data.representative : data.seller}
          signature={data.signature}
          witness={data.witness}
          witnessSign={data.witnessSign}
          place={data.place}
          brand={heading}
        />
      </Sheet>
    </>
  );
}
