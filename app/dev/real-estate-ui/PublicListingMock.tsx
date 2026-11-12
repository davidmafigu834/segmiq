"use client";

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */

import { useEffect, useId, useState, type FormEvent } from "react";
import { listingById, useMarketingLinks } from "./marketing-links";

type Shot = { label: string; src: string };

function frame(body: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">${body}</svg>`)}`;
}

const BAINES: Shot[] = [
  {
    label: "Street",
    src: frame(`<rect width="800" height="500" fill="#d7cfc3"/><rect y="340" width="800" height="160" fill="#c4b8a8"/><rect x="170" y="150" width="460" height="230" fill="#efeae3"/><path d="M140 190 L400 70 L660 190" fill="#2f3a32"/><rect x="360" y="250" width="80" height="130" fill="#c8bfb2"/><rect x="230" y="210" width="70" height="55" fill="#9eb0b8"/><rect x="500" y="210" width="70" height="55" fill="#9eb0b8"/>`),
  },
  {
    label: "Living room",
    src: frame(`<rect width="800" height="500" fill="#efeae3"/><rect y="360" width="800" height="140" fill="#cbbfae"/><rect x="80" y="80" width="280" height="200" fill="#d5e0e4"/><rect x="420" y="250" width="280" height="110" fill="#8d9a86"/><rect x="460" y="220" width="90" height="50" fill="#efeae3"/>`),
  },
  {
    label: "Garden",
    src: frame(`<rect width="800" height="500" fill="#e7efe4"/><rect y="300" width="800" height="200" fill="#b7c7a4"/><circle cx="180" cy="230" r="70" fill="#6e8a62"/><rect x="168" y="280" width="24" height="70" fill="#6a5644"/><rect x="480" y="160" width="220" height="150" fill="#efeae3"/><path d="M460 190 L590 90 L720 190" fill="#2f3a32"/>`),
  },
];

const HOMES: Record<string, {
  price: string | null;
  kind: string | null;
  deal: string | null;
  beds: number | null;
  baths: number | null;
  size: string | null;
  ownership: string | null;
  occupied: string | null;
  description: string;
  advertised: boolean;
  note: string | null;
  photos: Shot[];
}> = {
  baines: {
    price: "US$185,000",
    kind: "House",
    deal: "For sale",
    beds: 4,
    baths: 2,
    size: "220 m²",
    ownership: "Full title",
    occupied: "Owner occupied",
    description: "A house on a quiet avenue in Avondale, with a practical layout and a garden at the back.",
    advertised: true,
    note: null,
    photos: BAINES,
  },
  kingsmead: {
    price: null,
    kind: null,
    deal: "For sale",
    beds: null,
    baths: null,
    size: null,
    ownership: null,
    occupied: null,
    description: "On the market in Borrowdale. The asking price is not published on this page.",
    advertised: true,
    note: null,
    photos: [{
      label: "Street",
      src: frame(`<rect width="800" height="500" fill="#d5d0c6"/><rect y="320" width="800" height="180" fill="#b7c4a4"/><rect x="90" y="170" width="620" height="190" fill="#efeae3"/><path d="M60 200 L400 60 L740 200" fill="#2f3a32"/><rect x="150" y="220" width="90" height="60" fill="#9eb0b8"/><rect x="560" y="220" width="90" height="60" fill="#9eb0b8"/><rect x="360" y="230" width="80" height="130" fill="#c8bfb2"/>`),
    }],
  },
  stonechat: {
    price: null,
    kind: null,
    deal: null,
    beds: null,
    baths: null,
    size: null,
    ownership: null,
    occupied: null,
    description: "This property is in preparation. The page is not advertising it as available.",
    advertised: false,
    note: "Not advertised as available.",
    photos: [{
      label: "Lane",
      src: frame(`<rect width="800" height="500" fill="#e4e7df"/><rect y="360" width="800" height="140" fill="#c4b8a8"/><rect x="250" y="140" width="300" height="230" fill="#efeae3"/><path d="M220 180 L400 80 L580 180" fill="#2f3a32"/><circle cx="120" cy="250" r="46" fill="#6e8a62"/><rect x="110" y="290" width="18" height="70" fill="#6a5644"/>`),
    }],
  },
  kensington: {
    price: null,
    kind: "Flat",
    deal: "For sale",
    beds: null,
    baths: null,
    size: null,
    ownership: null,
    occupied: null,
    description: "A flat in Kensington. The listing is under offer.",
    advertised: true,
    note: "Under offer. An enquiry still reaches Tatenda Marufu.",
    photos: [{
      label: "Building",
      src: frame(`<rect width="800" height="500" fill="#d7cfc3"/><rect y="420" width="800" height="80" fill="#c4b8a8"/><rect x="230" y="70" width="340" height="360" fill="#efeae3"/><rect x="270" y="110" width="70" height="50" fill="#9eb0b8"/><rect x="460" y="110" width="70" height="50" fill="#9eb0b8"/><rect x="270" y="200" width="70" height="50" fill="#9eb0b8"/><rect x="460" y="200" width="70" height="50" fill="#9eb0b8"/><rect x="270" y="290" width="70" height="50" fill="#9eb0b8"/><rect x="460" y="290" width="70" height="50" fill="#9eb0b8"/><rect x="360" y="360" width="80" height="70" fill="#c8bfb2"/>`),
    }],
  },
  brooke: {
    price: null,
    kind: null,
    deal: "For sale",
    beds: null,
    baths: null,
    size: null,
    ownership: null,
    occupied: null,
    description: "On the market in Borrowdale. The asking price is not published on this page.",
    advertised: true,
    note: null,
    photos: [{
      label: "Street",
      src: frame(`<rect width="800" height="500" fill="#e7efe4"/><rect y="330" width="800" height="170" fill="#b7c7a4"/><rect x="200" y="160" width="400" height="200" fill="#efeae3"/><path d="M160 190 L400 70 L640 190" fill="#2f3a32"/><rect x="370" y="240" width="70" height="120" fill="#c8bfb2"/><rect x="250" y="210" width="60" height="46" fill="#9eb0b8"/><rect x="490" y="210" width="60" height="46" fill="#9eb0b8"/>`),
    }],
  },
};

export function PublicListingMock({
  listingId,
  onBack,
  onOpen,
}: {
  listingId: string;
  onBack: () => void;
  onOpen: (listingId: string) => void;
}) {
  const links = useMarketingLinks();
  const listing = listingById(listingId) ?? listingById("baines");
  const home = listing ? HOMES[listing.id] ?? HOMES.baines : HOMES.baines;
  const [photo, setPhoto] = useState(0);
  const [full, setFull] = useState(false);
  const [sheet, setSheet] = useState<"enquire" | "viewing" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const sheetTitle = useId();

  useEffect(() => {
    setPhoto(0);
    setFull(false);
    setSheet(null);
    setNotice(null);
    setError(null);
    setCopied(false);
  }, [listingId]);

  useEffect(() => {
    if (!sheet && !full) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSheet(null);
        setFull(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, full]);

  if (!listing) return null;

  const mine = links.filter((link) => link.listingId === listing.id);
  const live = mine.filter((link) => !link.revoked);
  const revokedOnly = mine.length > 0 && live.length === 0;
  const shot = home.photos[photo % home.photos.length];
  const facts = [
    home.beds != null ? `${home.beds} bed` : null,
    home.baths != null ? `${home.baths} bath` : null,
    home.size,
    home.kind,
    home.deal,
  ].filter((item): item is string => Boolean(item));
  const specs: Array<[string, string]> = [
    ["Address", `${listing.address}, ${listing.suburb}, Harare`],
    ["Status", listing.status],
  ];
  if (home.kind) specs.push(["Type", home.kind]);
  if (home.beds != null) specs.push(["Bedrooms", String(home.beds)]);
  if (home.baths != null) specs.push(["Bathrooms", String(home.baths)]);
  if (home.size) specs.push(["Size", home.size]);
  if (home.ownership) specs.push(["Ownership", home.ownership]);
  if (home.occupied) specs.push(["Occupied by", home.occupied]);
  if (home.price) specs.push(["Asking price", home.price]);
  const others = ["baines", "kingsmead", "brooke"]
    .filter((id) => id !== listing.id)
    .map((id) => listingById(id))
    .flatMap((item) => (item && item.status === "On the market" ? [item] : []));

  async function share() {
    const path = live[0]?.path ?? `https://www.segmiq.com/property/${listing.id}?ref=desk`;
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      /* The button still confirms the copy. */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function openSheet(next: "enquire" | "viewing") {
    setError(null);
    setNotice(null);
    setSheet(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sheet || pending) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (name.length < 2) {
      setError("Enter your name.");
      return;
    }
    if (phone.length < 7) {
      setError("Enter a phone number.");
      return;
    }
    if (sheet === "viewing" && (!form.get("date") || !form.get("time"))) {
      setError("Choose a date and time.");
      return;
    }
    const kind = sheet;
    setError(null);
    setPending(true);
    window.setTimeout(() => {
      setPending(false);
      setSheet(null);
      setNotice(
        kind === "enquire"
          ? `Enquiry sent. Tatenda Marufu has it for ${listing.address}.`
          : "Viewing request sent. It names a preferred time. It does not book the viewing.",
      );
    }, 480);
  }

  if (revokedOnly) {
    return (
      <div className="re-pub">
        <header className="re-pub-bar">
          <button type="button" className="re-pub-back" onClick={onBack}>Back</button>
          <img className="re-pub-mark" src="/segmiq-wordmark.png" alt="SegmiQ" />
        </header>
        <main className="re-pub-empty">
          <p className="re-pub-kicker">{listing.address}</p>
          <h1>This property link is unavailable</h1>
          <p>The listing is not being marketed on this link. No private property details are shown.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="re-pub">
      <header className="re-pub-bar">
        <button type="button" className="re-pub-back" onClick={onBack}>Back</button>
        <img className="re-pub-mark" src="/segmiq-wordmark.png" alt="SegmiQ" />
        <button type="button" className="re-pub-share" onClick={() => void share()}>{copied ? "Copied" : "Share"}</button>
      </header>

      <div className="re-pub-wrap">
        {live.length === 0 ? <p className="re-pub-preview">Preview. Buyers see this after the link is created.</p> : null}
        {notice ? <p className="re-pub-banner" role="status">{notice}</p> : null}

        <div className="re-pub-stage">
        <figure className="re-pub-hero">
          <button type="button" className="re-pub-shot" onClick={() => setFull(true)} aria-label={`Open ${shot.label} photograph`}>
            <img src={shot.src} alt={shot.label} />
          </button>
          <figcaption className="re-pub-nav">
            <p>{shot.label}{home.photos.length > 1 ? ` · ${photo + 1} of ${home.photos.length}` : ""}</p>
            {home.photos.length > 1 ? (
              <div>
                <button type="button" onClick={() => setPhoto((value) => (value + home.photos.length - 1) % home.photos.length)}>Previous</button>
                <button type="button" onClick={() => setPhoto((value) => (value + 1) % home.photos.length)}>Next</button>
              </div>
            ) : null}
          </figcaption>
          {home.photos.length > 1 ? (
            <div className="re-pub-thumbs">
              {home.photos.map((item, index) => (
                <button key={item.label} type="button" data-on={index === photo} aria-label={item.label} onClick={() => setPhoto(index)}>
                  <img src={item.src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </figure>

        <aside className="re-pub-offer">
            <p className="re-pub-kicker">{listing.suburb}, Harare</p>
            <h1 id={titleId}>{listing.address}</h1>
            <p className="re-pub-price">{home.price ?? "Price on request"}</p>
            <p className="re-pub-status">{listing.status}</p>
            {facts.length ? (
              <ul className="re-pub-facts">
                {facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            ) : null}
            {home.note ? <p className="re-pub-note">{home.note}</p> : null}
            <div className="re-pub-actions">
              <button type="button" className="re-pub-go" onClick={() => openSheet("enquire")}>Enquire</button>
              <button type="button" className="re-pub-line" onClick={() => openSheet("viewing")}>Request viewing</button>
              <button
                type="button"
                className="re-pub-line"
                onClick={() => setNotice(`WhatsApp draft ready for ${listing.address}.`)}
              >
                WhatsApp
              </button>
            </div>
            <div className="re-pub-agent">
              <span aria-hidden>TM</span>
              <div>
                <p>Tatenda Marufu</p>
                <p>Agent · replies to this page</p>
              </div>
            </div>
          </aside>
          <div className="re-pub-grid">
          <article className="re-pub-copy">
            <h2 className="re-pub-about">About this property</h2>
            <p className="re-pub-lead">{home.description}</p>
            <dl className="re-pub-specs">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {others.length ? (
              <section className="re-pub-more">
                <h2>Also on the market</h2>
                <ul>
                  {others.map((item) => {
                    const price = HOMES[item.id]?.price;
                    return (
                      <li key={item.id}>
                        <button type="button" onClick={() => onOpen(item.id)}>
                          <span>{item.address}</span>
                          <span>{[item.suburb, price ?? "Price on request"].join(" · ")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </article>
          </div>
        </div>

        <footer className="re-pub-foot">
          <p>Presented by Tatenda Marufu</p>
          <p>Powered by SegmiQ</p>
        </footer>
      </div>

      <div className="re-pub-dock">
        <p>{home.price ?? "Price on request"}</p>
        <button type="button" className="re-pub-go" onClick={() => openSheet("enquire")}>Enquire</button>
      </div>

      {sheet ? (
        <>
          <button type="button" className="re-pub-backdrop" aria-label="Close" onClick={() => setSheet(null)} />
          <section className="re-pub-sheet" role="dialog" aria-modal="true" aria-labelledby={sheetTitle}>
            <div className="re-pub-sheet-head">
              <h2 id={sheetTitle}>{sheet === "enquire" ? "Enquire" : "Request a viewing"}</h2>
              <button type="button" onClick={() => setSheet(null)}>Close</button>
            </div>
            <p className="re-pub-sheet-lead">{listing.address}</p>
            <form onSubmit={submit}>
              <label>
                Name
                <input name="name" autoComplete="name" required minLength={2} maxLength={120} />
              </label>
              <label>
                Phone
                <input name="phone" inputMode="tel" autoComplete="tel" required maxLength={40} />
              </label>
              {sheet === "viewing" ? (
                <>
                  <label>Preferred date<input name="date" type="date" required /></label>
                  <label>Preferred time<input name="time" type="time" required /></label>
                </>
              ) : (
                <label>
                  Preferred contact
                  <select name="contactMethod" defaultValue="either">
                    <option value="either">Either</option>
                    <option value="phone">Phone</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
              )}
              <label>
                Message
                <textarea name="message" maxLength={2000} rows={3} />
              </label>
              <p className="re-pub-consent">
                {sheet === "viewing"
                  ? "This sends a preferred time. It does not book the viewing."
                  : "Tatenda Marufu will use these details to reply about this property."}
              </p>
              {error ? <p className="re-pub-error" role="alert">{error}</p> : null}
              <button className="re-pub-go" type="submit" disabled={pending}>
                {pending ? "Sending" : sheet === "enquire" ? "Send enquiry" : "Send request"}
              </button>
            </form>
          </section>
        </>
      ) : null}

      {full ? (
        <dialog className="re-pub-lightbox" open aria-label={shot.label}>
          <button type="button" onClick={() => setFull(false)}>Close</button>
          <img src={shot.src} alt={shot.label} />
        </dialog>
      ) : null}
    </div>
  );
}
