/* Public photos and logos are proxied bytes or arbitrary agency https URLs, so next/image host allowlists do not apply. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useId, useState, type CSSProperties, type FormEvent } from "react";
import styles from "./property-page.module.css";

type Photo = { index: number; src: string };
type Related = { heading: string; suburb: string | null; bedrooms: number | null; bathrooms: number | null; href: string | null };
export type PublicListingModel = {
  slug: string;
  property: {
    heading: string;
    suburb: string | null;
    priceLabel: string | null;
    currencyContext: "quotation_currency" | "unconfigured";
    transactionLabel: string | null;
    categoryLabel: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqm: number | null;
    description: string | null;
    statusLabel: string;
    advertiseAsAvailable: boolean;
    photoCount: number;
  };
  agency: { name: string; logoUrl: string | null; websiteUrl: string | null; catalogueUrl: string | null; accent: string | null };
  agent: { name: string; role: string; initials: string; photoUrl: string | null } | null;
  actions: { enquire: boolean; viewing: boolean; whatsapp: string | null };
  photos: Photo[];
  related: Related[];
};

function refToken(): string | null {
  const value = new URLSearchParams(window.location.search).get("ref");
  return value && /^[A-Za-z0-9_-]{32,80}$/.test(value) ? value : null;
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  return { ok: response.ok, error: json.error, message: json.message };
}

export function PublicListingPage({ model }: { model: PublicListingModel }) {
  const [photo, setPhoto] = useState(0);
  const [full, setFull] = useState(false);
  const [sheet, setSheet] = useState<"enquire" | "viewing" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const current = model.photos[photo];
  const facts = [
    model.property.transactionLabel,
    model.property.categoryLabel,
    model.property.bedrooms != null ? `${model.property.bedrooms} bedrooms` : null,
    model.property.bathrooms != null ? `${model.property.bathrooms} bathrooms` : null,
    model.property.sizeSqm != null ? `${model.property.sizeSqm} m²` : null,
  ].filter((item): item is string => Boolean(item));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/public/listing-pages/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: model.slug, token: refToken(), eventType: "engaged_view" }),
      });
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [model.slug]);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: model.property.heading, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    await navigator.clipboard.writeText(url);
    setNotice("Link copied");
  }

  async function submit(event: FormEvent<HTMLFormElement>, kind: "enquire" | "viewing") {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date") ?? "");
    const time = String(form.get("time") ?? "");
    let preferredAt: string | null = null;
    if (kind === "viewing") {
      const local = new Date(`${date}T${time}`);
      if (Number.isNaN(local.getTime())) {
        setPending(false);
        setError("Choose a date and time.");
        return;
      }
      preferredAt = local.toISOString();
    }
    const result = await postJson(kind === "enquire" ? "/api/public/listing-pages/enquiry" : "/api/public/listing-pages/viewing", {
      slug: model.slug,
      token: refToken(),
      name: form.get("name"),
      phone: form.get("phone"),
      message: form.get("message") || null,
      contactMethod: form.get("contactMethod") || null,
      preferredAt,
      companyWebsiteConfirm: form.get("companyWebsiteConfirm") || "",
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not send that. Please try again.");
      return;
    }
    setSheet(null);
    setNotice(result.message ?? "Sent.");
  }

  return (
    <div className={styles.page} style={model.agency.accent ? ({ ["--brand-accent" as string]: model.agency.accent } as CSSProperties) : undefined} data-accent={model.agency.accent ? "brand" : undefined}>
      <div className={`${styles.wrap} ${styles.pad}`}>
        <header className={styles.header}>
          <div className={styles.brand}>
            {model.agency.logoUrl ? <img className={styles.logo} src={model.agency.logoUrl} alt="" /> : <div className={styles.mark} aria-hidden>{model.agency.name.slice(0, 1)}</div>}
            <div>
              <p className={styles.agency}>{model.agency.name}</p>
              <p className={styles.place}>{model.property.suburb || "Property"}</p>
            </div>
          </div>
          <button className={styles.share} type="button" onClick={() => void share()}>Share</button>
        </header>
        <section className={styles.hero}>
          <div className={styles.frame}>
            {current ? (
              <button type="button" className={styles.shot} onClick={() => setFull(true)} aria-label="Open photograph">
                <img src={current.src} alt="" />
              </button>
            ) : (
              <div className={styles.shot} role="img" aria-label="Photograph not published" />
            )}
            {model.photos.length > 1 ? (
              <>
                <button className={`${styles.navBtn} ${styles.prev}`} type="button" aria-label="Previous photograph" onClick={() => setPhoto((value) => (value - 1 + model.photos.length) % model.photos.length)}>‹</button>
                <button className={`${styles.navBtn} ${styles.next}`} type="button" aria-label="Next photograph" onClick={() => setPhoto((value) => (value + 1) % model.photos.length)}>›</button>
              </>
            ) : null}
            {model.photos.length > 0 ? <span className={styles.counter}>{photo + 1} / {model.photos.length}</span> : null}
          </div>
          <div className={styles.summary}>
            <p className={styles.status}>{model.property.statusLabel}</p>
            <h1 id={titleId}>{model.property.heading}</h1>
            {model.property.priceLabel ? <p className={styles.price}>{model.property.priceLabel}</p> : null}
            {model.property.priceLabel && model.property.currencyContext === "quotation_currency" ? <p className={styles.currencyNote}>Shown in the agency quotation currency.</p> : null}
            {model.property.priceLabel && model.property.currencyContext === "unconfigured" ? <p className={styles.currencyNote}>The agency has not configured a currency for this amount.</p> : null}
            {!model.property.advertiseAsAvailable ? <p className={styles.statusNote}>This property is not being advertised as available.</p> : null}
            <ul className={styles.facts}>{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
            {model.agent ? (
              <div className={styles.agent}>
                {model.agent.photoUrl ? <img className={styles.avatar} src={model.agent.photoUrl} alt="" /> : <div className={styles.avatar}>{model.agent.initials}</div>}
                <div>
                  <strong>{model.agent.name}</strong>
                  <p className={styles.quiet}>{model.agent.role} · {model.agency.name}</p>
                </div>
              </div>
            ) : null}
            <div className={styles.sticky}>
              {model.actions.enquire ? <button className={styles.primary} type="button" onClick={() => { setError(null); setSheet("enquire"); }}>Enquire</button> : null}
              {model.actions.viewing ? <button className={styles.ghost} type="button" onClick={() => { setError(null); setSheet("viewing"); }}>Request viewing</button> : null}
              {model.actions.whatsapp ? (
                <a href={model.actions.whatsapp} onClick={() => {
                  void fetch("/api/public/listing-pages/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: model.slug, token: refToken(), eventType: "whatsapp_click" }) });
                }}>WhatsApp</a>
              ) : null}
            </div>
          </div>
        </section>
        {model.property.description ? <section className={styles.section}><h2>About the property</h2><p className={styles.prose}>{model.property.description}</p></section> : null}
        {notice ? <p className={styles.section} role="status">{notice}</p> : null}
        {model.related.length ? (
          <section className={`${styles.section} ${styles.related}`}>
            <h2>More properties from {model.agency.name}</h2>
            <div className={styles.grid}>
              {model.related.map((item) => {
                const body = (
                  <>
                    <strong>{item.heading}</strong>
                    <span className={styles.quiet}>{[item.suburb, item.bedrooms != null ? `${item.bedrooms} bed` : null, item.bathrooms != null ? `${item.bathrooms} bath` : null].filter(Boolean).join(" · ")}</span>
                  </>
                );
                return item.href ? <a key={item.heading + (item.suburb ?? "")} href={item.href}>{body}</a> : <div key={item.heading + (item.suburb ?? "")}>{body}</div>;
              })}
            </div>
            {!model.agency.catalogueUrl ? <p className={styles.quiet}>Individual website links are not configured, so these stay on this page.</p> : null}
          </section>
        ) : null}
        <footer className={styles.footer}>
          {model.agency.websiteUrl ? <a href={model.agency.websiteUrl}>Visit {model.agency.name}</a> : null}
          <p>Powered by <a href="https://www.segmiq.com">SegmiQ</a></p>
        </footer>
      </div>
      {sheet ? (
        <>
          <button className={styles.backdrop} type="button" aria-label="Close" onClick={() => setSheet(null)} />
          <section className={styles.sheet} role="dialog" aria-labelledby={titleId}>
            <h2>{sheet === "enquire" ? "Enquire about this property" : "Request a viewing"}</h2>
            <form onSubmit={(event) => void submit(event, sheet)}>
              <label>Name<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
              <label>Phone<input name="phone" required inputMode="tel" autoComplete="tel" maxLength={40} /></label>
              {sheet === "viewing" ? (
                <>
                  <label>Preferred date<input name="date" type="date" required /></label>
                  <label>Preferred time<input name="time" type="time" required /></label>
                </>
              ) : (
                <label>Preferred contact
                  <select name="contactMethod" defaultValue="either">
                    <option value="either">Either</option>
                    <option value="phone">Phone</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
              )}
              <label>Message<textarea name="message" maxLength={2000} /></label>
              <label className={styles.honeypot}>Website<input name="companyWebsiteConfirm" tabIndex={-1} autoComplete="off" /></label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Sending" : sheet === "enquire" ? "Send enquiry" : "Send request"}</button>
            </form>
          </section>
        </>
      ) : null}
      {full && current ? (
        <dialog className={styles.dialog} open onClick={() => setFull(false)}>
          <img src={current.src} alt="" />
        </dialog>
      ) : null}
    </div>
  );
}
