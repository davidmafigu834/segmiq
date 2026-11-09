"use client";

/* Public photos and logos are proxied bytes or arbitrary agency https URLs, so next/image host allowlists do not apply. */
/* eslint-disable @next/next/no-img-element */

import { useState, type CSSProperties, type FormEvent } from "react";
import { VIEWING_ACCENT, viewingAccentInk, type ViewingPropertyCard } from "@/lib/real-estate/workflow/viewing-form";
import styles from "./viewing-request-form.module.css";

export type ViewingFormPreview = {
  brand?: {
    agencyName?: string;
    logoUrl?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    accent?: string | null;
  };
  property?: ViewingPropertyCard;
  slots?: string[];
  synthetic?: boolean;
  error?: string;
};

function slotParts(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: iso, time: "" };
  return {
    day: new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(date),
    time: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function HouseMark() {
  return (
    <svg viewBox="0 0 120 80" fill="none" stroke="#2f3a32" strokeWidth="1.6" aria-hidden>
      <path d="M10 46 L60 14 L110 46" />
      <path d="M24 44 V70 H96 V44" />
      <path d="M50 70 V52 H70 V70" />
    </svg>
  );
}

export function Photographs({ urls, heading }: { urls: string[]; heading: string }) {
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [active, setActive] = useState(0);
  const available = urls.map((url, index) => ({ url, index })).filter((item) => !failed[item.index]);
  const current = available.find((item) => item.index === active) ?? available[0];
  if (!current) {
    return (
      <div className={styles.plate}>
        <div>
          <HouseMark />
          <p>The listing photograph appears here.</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className={styles.platePhoto}>
        <img src={current.url} alt={`Photograph of ${heading}`} onError={() => setFailed((currentFailed) => ({ ...currentFailed, [current.index]: true }))} />
      </div>
      {available.length > 1 ? (
        <div className={styles.film} role="list">
          {available.map((item, position) => (
            <button key={`${item.index}-${item.url}`} type="button" aria-label={`Photograph ${position + 1}`} aria-pressed={item.index === current.index} onClick={() => setActive(item.index)}>
              <img src={item.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ViewingRequestForm({ token, preview }: { token: string; preview: ViewingFormPreview | null }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [signature, setSignature] = useState("");
  const [slot, setSlot] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const brand = preview?.brand;
  const property = preview?.property;
  const agency = brand?.agencyName?.trim() || "Agency";
  const accent = brand?.accent && /^#[0-9a-fA-F]{6}$/.test(brand.accent) ? brand.accent : VIEWING_ACCENT;
  const accentInk = viewingAccentInk(accent);
  const tone = { "--accent": accent, "--accent-ink": accentInk } as CSSProperties;
  const contact = [brand?.contactName, brand?.contactPhone].filter(Boolean).join(" · ");
  const chosen = slot || preview?.slots?.[0] || "";
  const facts = [
    property?.categoryLabel ? { value: property.categoryLabel, label: "Type" } : null,
    property?.bedrooms != null ? { value: String(property.bedrooms), label: property.bedrooms === 1 ? "Bedroom" : "Bedrooms" } : null,
    property?.bathrooms != null ? { value: String(property.bathrooms), label: property.bathrooms === 1 ? "Bathroom" : "Bathrooms" } : null,
    property?.transactionLabel ? { value: property.transactionLabel, label: "Listing" } : null,
  ].filter((item): item is { value: string; label: string } => item != null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosen || pending) return;
    setPending(true);
    setResult(null);
    setFailed(false);
    try {
      const response = await fetch(`/api/public/journey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "viewing", slot: chosen, name, phone, signature }),
      });
      const json = (await response.json().catch(() => ({}))) as { copy?: string; error?: string };
      setFailed(!response.ok);
      setResult(response.ok ? (json.copy ?? "Saved.") : (json.error ?? "The form was not saved."));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.page} style={tone}>
      <div className={styles.wrap}>
        <header className={styles.bar}>
          <div className={styles.brand}>
            {brand?.logoUrl ? <img className={styles.logo} src={brand.logoUrl} alt="" /> : <div className={styles.mark} aria-hidden="true">{agency.slice(0, 1).toUpperCase()}</div>}
            <div>
              <p className={styles.agency}>{preview ? agency : "Loading"}</p>
              {contact ? <p className={styles.agent}>{contact}</p> : null}
            </div>
          </div>
        </header>
        {!preview ? <p className={styles.lead}>Loading the viewing form.</p> : null}
        {preview?.error ? <p className={styles.alert} role="alert">{preview.error}</p> : null}
        {preview && !preview.error ? (
          <div className={styles.sheet}>
            <section className={styles.house} aria-label="The property">
              <p className={styles.kicker}>Viewing request</p>
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
            <form className={styles.form} aria-label="Request a viewing" onSubmit={(event) => void submit(event)}>
              <h2 className={styles.choice}>Choose a time</h2>
              <p className={styles.lead}>These are the times {agency} has offered for this house.</p>
              <div className={styles.times}>
                {(preview.slots ?? []).map((item) => {
                  const parts = slotParts(item);
                  return (
                    <button key={item} type="button" className={styles.time} aria-pressed={chosen === item} onClick={() => setSlot(item)}>
                      <strong>{parts.day}</strong>
                      {parts.time ? <span>{parts.time}</span> : null}
                    </button>
                  );
                })}
              </div>
              {(preview.slots ?? []).length === 0 ? <p className={styles.note}>This link has no offered time. Ask {agency} for another one.</p> : null}
              <div className={styles.fields}>
                <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" autoComplete="name" required /></label>
                <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number" autoComplete="tel" required /></label>
                <label className={`${styles.wide} ${styles.sign}`}>Signature<input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="Sign your name" required /></label>
              </div>
              <p className={styles.note}>Signing confirms you want this time. It is not a booking until {agency} confirms it.</p>
              <button className={styles.submit} type="submit" disabled={pending || !chosen}>{pending ? "Sending" : "Request this viewing"}</button>
              {result ? <p className={failed ? styles.alert : styles.status} role={failed ? "alert" : "status"}>{result}</p> : null}
              <p className={styles.foot}>Prepared with SegmiQ for {agency}.</p>
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
