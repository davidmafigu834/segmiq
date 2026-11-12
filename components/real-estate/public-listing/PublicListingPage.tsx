/* Public photos and logos are proxied bytes or arbitrary agency https URLs, so next/image host allowlists do not apply. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import styles from "./property-page.module.css";

type Photo = { index: number; src: string };
type Related = {
  heading: string;
  suburb: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  priceLabel?: string | null;
  photoSrc?: string | null;
  href: string | null;
};
export type PublicListingModel = {
  slug: string;
  property: {
    heading: string;
    suburb: string | null;
    address?: string | null;
    priceLabel: string | null;
    priceOnRequest?: boolean;
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

function EmptyHero({ category, suburb }: { category: string | null; suburb: string | null }) {
  return (
    <div className={styles.fallback} role="img" aria-label="Photographs are not published for this property">
      <svg viewBox="0 0 72 48" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M6 28 L36 8 L66 28" />
        <path d="M14 26 V42 H58 V26" />
        <path d="M30 42 V32 H42 V42" />
      </svg>
      <strong>{category || "Property"}{suburb ? ` · ${suburb}` : ""}</strong>
      <span>Photographs are not available yet.</span>
    </div>
  );
}

export function PublicListingPage({ model }: { model: PublicListingModel }) {
  const [photo, setPhoto] = useState(0);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const [full, setFull] = useState(false);
  const [sheet, setSheet] = useState<"enquire" | "viewing" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const touchX = useRef(0);
  const photos = model.photos.filter((item) => !broken[item.index]);
  const safeIndex = photos.length ? photo % photos.length : 0;
  const current = photos[safeIndex];
  const facts: string[] = [];
  if (model.property.bedrooms != null) facts.push(`${model.property.bedrooms} bed`);
  if (model.property.bathrooms != null) facts.push(`${model.property.bathrooms} bath`);
  if (model.property.sizeSqm != null) facts.push(`${model.property.sizeSqm} m²`);
  if (model.property.transactionLabel) facts.push(model.property.transactionLabel);
  if (model.property.categoryLabel) facts.push(model.property.categoryLabel);
  const verifiedPrice = model.property.currencyContext === "quotation_currency" ? model.property.priceLabel : null;
  const priceOnRequest = Boolean(model.property.priceOnRequest);

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

  function step(direction: number) {
    if (photos.length < 2) return;
    setPhoto((value) => (value + direction + photos.length) % photos.length);
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: model.property.heading, text: model.agency.name, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  function openSheet(next: "enquire" | "viewing") {
    setError(null);
    setSheet(next);
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

  function whatsApp(className?: string) {
    if (!model.actions.whatsapp) return null;
    return (
      <a className={className} href={model.actions.whatsapp} onClick={() => {
        void fetch("/api/public/listing-pages/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: model.slug, token: refToken(), eventType: "whatsapp_click" }),
        });
      }}>WhatsApp</a>
    );
  }

  const priceLine = verifiedPrice ?? (priceOnRequest ? "Price on request" : null);
  const specs: Array<[string, string]> = [];
  if (model.property.address) specs.push(["Address", model.property.address]);
  if (model.property.suburb) specs.push(["Suburb", model.property.suburb]);
  specs.push(["Status", model.property.statusLabel]);
  if (model.property.categoryLabel) specs.push(["Type", model.property.categoryLabel]);
  if (model.property.transactionLabel) specs.push(["Listing", model.property.transactionLabel]);
  if (model.property.bedrooms != null) specs.push(["Bedrooms", String(model.property.bedrooms)]);
  if (model.property.bathrooms != null) specs.push(["Bathrooms", String(model.property.bathrooms)]);
  if (model.property.sizeSqm != null) specs.push(["Size", `${model.property.sizeSqm} m²`]);
  if (verifiedPrice) specs.push(["Asking price", verifiedPrice]);

  const actions = (
    <>
      {model.actions.enquire ? <button className={styles.primary} type="button" onClick={() => openSheet("enquire")}>Enquire</button> : null}
      {model.actions.viewing ? <button className={styles.ghost} type="button" onClick={() => openSheet("viewing")}>Request viewing</button> : null}
      {whatsApp(styles.ghost)}
    </>
  );

  return (
    <div className={`${styles.page} ${styles.pad} sales-dashboard-premium`} data-re-form="dark" style={model.agency.accent ? ({ ["--brand-accent" as string]: model.agency.accent } as CSSProperties) : undefined} data-accent={model.agency.accent ? "brand" : undefined}>
      <div className={styles.wrap}>
        <header className={styles.bar}>
          <div className={styles.brand}>
            {model.agency.logoUrl ? <img className={styles.logo} src={model.agency.logoUrl} alt="" /> : <div className={styles.mark} aria-hidden>{model.agency.name.slice(0, 1)}</div>}
            <p className={styles.agency}>{model.agency.name}</p>
          </div>
          <button className={styles.share} type="button" onClick={() => void share()}>{copied ? "Copied" : "Share"}</button>
        </header>

        <div className={styles.stage}>
          <div className={styles.gallery} data-empty={current ? "false" : "true"} data-multi={photos.length > 1 ? "true" : "false"}>
            <div
              className={styles.frame}
              onTouchStart={(event) => { touchX.current = event.changedTouches[0]?.clientX ?? 0; }}
              onTouchEnd={(event) => {
                const delta = (event.changedTouches[0]?.clientX ?? 0) - touchX.current;
                if (Math.abs(delta) > 40) step(delta < 0 ? 1 : -1);
              }}
            >
              {current ? (
                <button type="button" className={styles.shot} onClick={() => setFull(true)} aria-label="Open photograph">
                  <img src={current.src} alt="" onError={() => setBroken((value) => ({ ...value, [current.index]: true }))} />
                </button>
              ) : (
                <EmptyHero category={model.property.categoryLabel} suburb={model.property.suburb} />
              )}
            </div>
            <div className={styles.nav}>
              <p>{photos.length > 1 ? `${safeIndex + 1} of ${photos.length}` : current ? "Photograph" : "No photograph"}</p>
              {photos.length > 1 ? (
                <div>
                  <button type="button" onClick={() => step(-1)}>Previous</button>
                  <button type="button" onClick={() => step(1)}>Next</button>
                </div>
              ) : null}
            </div>
            {photos.length > 1 ? (
              <div className={styles.thumbs}>
                {photos.map((item, index) => (
                  <button key={item.src} type="button" data-on={index === safeIndex} aria-label={`Photograph ${index + 1}`} onClick={() => setPhoto(index)}>
                    <img src={item.src} alt="" onError={() => setBroken((value) => ({ ...value, [item.index]: true }))} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <aside className={styles.panel}>
            {model.property.suburb ? <p className={styles.kicker}>{model.property.suburb}</p> : null}
            <h1 id={titleId}>{model.property.heading}</h1>
            {priceLine ? <p className={styles.price}>{priceLine}</p> : null}
            <p className={styles.status}>{model.property.statusLabel}</p>
            {!model.property.advertiseAsAvailable ? <p className={styles.statusNote}>This property is not being advertised as available.</p> : null}
            {facts.length ? (
              <ul className={styles.facts}>
                {facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            ) : null}
            <div className={styles.actions}>{actions}</div>
            {model.agent ? (
              <div className={styles.agent}>
                {model.agent.photoUrl ? <img className={styles.avatar} src={model.agent.photoUrl} alt="" /> : <div className={styles.avatar}>{model.agent.initials}</div>}
                <div>
                  <strong>{model.agent.name}</strong>
                  <p className={styles.quiet}>{model.agency.name} · {model.agent.role}</p>
                </div>
              </div>
            ) : null}
          </aside>

          <div className={styles.story}>
            {model.property.description ? (
              <section className={styles.block}>
                <h2>About this property</h2>
                <p className={styles.prose}>{model.property.description}</p>
              </section>
            ) : null}
            {specs.length ? (
              <dl className={styles.specs}>
                {specs.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>

        {notice ? <p className={styles.banner} role="status">{notice}</p> : null}

        {model.related.length ? (
          <section className={styles.more}>
            <h2>Discover more homes from {model.agency.name}</h2>
            <div className={styles.scroller}>
              {model.related.map((item) => {
                const body = (
                  <>
                    <div className={styles.cardFigure}>
                      {item.photoSrc ? <img src={item.photoSrc} alt="" /> : <div className={styles.cardMark}>No photograph</div>}
                    </div>
                    <div>
                      <strong>{item.heading}</strong>
                      <span className={styles.quiet}>{[item.suburb, item.priceLabel, item.bedrooms != null ? `${item.bedrooms} bed` : null, item.bathrooms != null ? `${item.bathrooms} bath` : null].filter(Boolean).join(" · ")}</span>
                    </div>
                  </>
                );
                return item.href
                  ? <a key={item.heading + (item.suburb ?? "")} className={styles.card} href={item.href}>{body}</a>
                  : <div key={item.heading + (item.suburb ?? "")} className={styles.card}>{body}</div>;
              })}
            </div>
            {model.agency.catalogueUrl ? <a className={styles.catalogue} href={model.agency.catalogueUrl}>Explore all properties at {model.agency.name}</a> : null}
          </section>
        ) : null}

        <footer className={styles.footer}>
          <strong>{model.agency.name}</strong>
          {model.agency.websiteUrl ? <a href={model.agency.websiteUrl}>Visit the agency website</a> : null}
          {!model.related.length && model.agency.catalogueUrl ? <a href={model.agency.catalogueUrl}>Explore all properties</a> : null}
          <p className={styles.credit}>Powered by <a href="https://www.segmiq.com">SegmiQ</a></p>
        </footer>
      </div>

      <div className={styles.dock}>
        {priceLine ? <p>{priceLine}</p> : <span />}
        {model.actions.enquire ? <button className={styles.primary} type="button" onClick={() => openSheet("enquire")}>Enquire</button> : model.actions.viewing ? <button className={styles.primary} type="button" onClick={() => openSheet("viewing")}>Request viewing</button> : whatsApp(styles.primary)}
      </div>

      {sheet ? (
        <>
          <button className={styles.backdrop} type="button" aria-label="Close" onClick={() => setSheet(null)} />
          <section className={styles.sheet} role="dialog" aria-labelledby={titleId}>
            <div className={styles.sheetHead}>
              <h2>{sheet === "enquire" ? "Enquire about this property" : "Request a viewing"}</h2>
              <button className={styles.textBtn} type="button" onClick={() => setSheet(null)}>Close</button>
            </div>
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
              <p className={styles.consent}>
                {sheet === "viewing"
                  ? `This sends a preferred time to ${model.agency.name}. It does not book the viewing.`
                  : `${model.agency.name} will use these details to reply about this property.`}
              </p>
              <label className={styles.honeypot} aria-hidden="true">Website<input name="companyWebsiteConfirm" tabIndex={-1} autoComplete="off" /></label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Sending" : sheet === "enquire" ? "Send enquiry" : "Send request"}</button>
            </form>
          </section>
        </>
      ) : null}

      {full && current ? (
        <dialog className={styles.dialog} open>
          <button className={styles.closeShot} type="button" onClick={() => setFull(false)}>Close</button>
          <img src={current.src} alt="" />
        </dialog>
      ) : null}
    </div>
  );
}
