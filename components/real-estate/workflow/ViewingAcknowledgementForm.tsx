"use client";

import { useRef, useState, type ReactNode } from "react";
import { SignaturePad } from "@/components/real-estate/workflow/SignaturePad";
import { VIEWING_PARTIES, formatViewingSlot, type ViewingFormCard, type ViewingParty, type ViewingPropertyCard } from "@/lib/real-estate/workflow/viewing-form";

type PropertyPreview = Partial<ViewingFormCard> & Partial<ViewingPropertyCard> & { photoCount?: number };

export type ViewingFormPreview = {
  purpose?: string;
  synthetic?: boolean;
  error?: string;
  propertyLabel?: string;
  slots?: string[];
  brand?: {
    agencyName?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  };
  property?: PropertyPreview;
};

function cardFacts(property: PropertyPreview | undefined): Array<{ label: string; value: string }> {
  if (property?.facts?.length) return property.facts;
  return [
    property?.priceLabel ? { label: "Asking", value: property.priceLabel } : null,
    property?.bedrooms != null ? { label: "Beds", value: String(property.bedrooms) } : null,
    property?.bathrooms != null ? { label: "Baths", value: String(property.bathrooms) } : null,
  ].filter((item): item is { label: string; value: string } => item != null);
}

function cardPlace(property: PropertyPreview | undefined): string | null {
  if (property?.placeLine) return property.placeLine;
  const kind = [property?.categoryLabel, property?.transactionLabel?.toLowerCase()].filter(Boolean).join(" ");
  const line = [property?.place, kind || null].filter(Boolean).join(". ");
  return line || null;
}

type Step = "time" | "who" | "confirm" | "sent";

const STEPS: Step[] = ["time", "who", "confirm"];

export function PublicJourneyShell({ children }: { children: ReactNode }) {
  return (
    <main className="sales-dashboard-premium h-dvh overflow-y-auto overscroll-y-contain bg-sales-bg px-4 py-6 text-sales-text-primary sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">{children}</div>
    </main>
  );
}

export function ViewingAcknowledgementForm({ token, preview }: { token: string; preview: ViewingFormPreview }) {
  const property = preview.property;
  const heading = property?.heading ?? "Property";
  const agent = preview.brand?.contactName?.trim() || preview.brand?.agencyName?.trim() || "The agency";
  const contactLine = [preview.brand?.contactPhone, preview.brand?.contactEmail].filter(Boolean).join(" · ");
  const photoSources = property?.photoUrls?.length
    ? property.photoUrls
    : property?.photoUrl
      ? [property.photoUrl]
      : Array.from({ length: Math.min(4, property?.photoCount ?? 0) }, (_, index) => `/api/public/journey/${token}/photos/${index}`);
  const facts = cardFacts(property);
  const placeLine = cardPlace(property);
  const note = property?.note ?? property?.description ?? null;
  const [step, setStep] = useState<Step>("time");
  const [slotId, setSlotId] = useState("");
  const [other, setOther] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState<ViewingParty>("Just me");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [hiddenPhotos, setHiddenPhotos] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<"booking" | "request">("request");
  const [copy, setCopy] = useState("");

  const offered = (preview.slots ?? []).filter((slot) => Number.isFinite(Date.parse(slot)));
  const when = slotId ? formatViewingSlot(slotId).label : other ? formatViewingSlot(other).label : "";
  const index = Math.max(0, STEPS.indexOf(step));
  const visiblePhotos = photoSources.filter((item) => !hiddenPhotos.includes(item));
  const activePhoto = photo && visiblePhotos.includes(photo) ? photo : visiblePhotos[0];
  const touchX = useRef(0);

  function stepPhoto(direction: number) {
    if (visiblePhotos.length < 2 || !activePhoto) return;
    const current = visiblePhotos.indexOf(activePhoto);
    const next = (current + direction + visiblePhotos.length) % visiblePhotos.length;
    setPhoto(visiblePhotos[next] ?? null);
  }

  function pickSlot(id: string) {
    setSlotId(id);
    setOther("");
    setError(null);
  }

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function continueFromTime() {
    if (!when || (other && !Number.isFinite(Date.parse(other)))) {
      setError("Choose a time the agent offered, or suggest another.");
      return;
    }
    go("who");
  }

  function continueFromWho() {
    if (name.trim().length < 2) {
      setError("Enter the name the agent should expect at the door.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      setError("Enter a phone number the agent can message.");
      return;
    }
    go("confirm");
  }

  async function send() {
    if (!agreed) {
      setError("Confirm how this time is booked.");
      return;
    }
    if (!signature.startsWith("data:image/png")) {
      setError("Draw your signature to confirm.");
      return;
    }
    const slot = slotId || new Date(other).toISOString();
    setError(null);
    setSending(true);
    const response = await fetch(`/api/public/journey/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "viewing", slot, name, phone, signature, party }),
    });
    const json = await response.json().catch(() => ({})) as { copy?: string; error?: string; outcome?: string };
    setSending(false);
    if (!response.ok) {
      setError(json.error ?? "The form was not saved.");
      return;
    }
    if (json.outcome === "unavailable") {
      setError(json.copy ?? "That time is no longer available. Ask the agency for another time.");
      return;
    }
    setOutcome(json.outcome === "booking" ? "booking" : "request");
    setCopy(json.copy ?? "The agency has your request.");
    setStep("sent");
  }

  return (
    <PublicJourneyShell>
      <div className="space-y-5">
        {preview.synthetic ? (
          <p className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3 text-[13px] text-sales-text-secondary">
            This is a practice form until the agency approves its template.
          </p>
        ) : null}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <aside className="min-w-0 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface lg:sticky lg:top-6">
            {activePhoto ? (
              <div>
                <div
                  className="relative touch-pan-y"
                  onTouchStart={(event) => { touchX.current = event.changedTouches[0]?.clientX ?? 0; }}
                  onTouchEnd={(event) => {
                    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchX.current;
                    if (Math.abs(delta) > 48) stepPhoto(delta < 0 ? 1 : -1);
                  }}
                >
                  {/* Public photos are served from this form's own link, so next/image host allowlists do not apply. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePhoto}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                    onError={() => setHiddenPhotos((current) => current.includes(activePhoto) ? current : [...current, activePhoto])}
                  />
                  {visiblePhotos.length > 1 ? (
                    <>
                      <button type="button" aria-label="Previous photograph" onClick={() => stepPhoto(-1)} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-[28px] leading-none text-white">‹</button>
                      <button type="button" aria-label="Next photograph" onClick={() => stepPhoto(1)} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-[28px] leading-none text-white">›</button>
                      <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white">{visiblePhotos.indexOf(activePhoto) + 1} / {visiblePhotos.length}</span>
                    </>
                  ) : null}
                </div>
                {visiblePhotos.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto px-3 py-3">
                    {visiblePhotos.map((item, itemIndex) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={activePhoto === item}
                        aria-label={`Photograph ${itemIndex + 1}`}
                        onClick={() => setPhoto(item)}
                        className={`h-16 w-20 shrink-0 overflow-hidden rounded-[8px] ring-2 ring-offset-1 ring-offset-transparent ${activePhoto === item ? "ring-sales-brand" : "ring-transparent"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="border-b border-sales-border-subtle px-5 py-5">
              <p className="text-[13px] font-medium text-sales-text-muted">{property?.sentBy ?? `${agent} sent this`}</p>
              {contactLine ? <p className="mt-1 text-[13px] text-sales-text-secondary">{contactLine}</p> : null}
              <h1 className="mt-2 break-words font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">{heading}</h1>
              {placeLine ? <p className="mt-2 text-[15px] text-sales-text-secondary">{placeLine}</p> : null}
            </div>
            {facts.length ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-5">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-[12px] text-sales-text-muted">{fact.label}</dt>
                    <dd className="mt-0.5 text-[16px] font-semibold">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {note ? (
              <p className="border-t border-sales-border-subtle px-5 py-4 text-[13px] leading-relaxed text-sales-text-secondary">{note}</p>
            ) : null}
          </aside>

          <section className="min-w-0 rounded-[12px] border border-sales-border bg-sales-surface px-5 py-5" aria-live="polite">
            {step !== "sent" ? (
              <div className="flex items-center gap-2" aria-label={`Part ${index + 1} of 3`}>
                {STEPS.map((item, itemIndex) => (
                  <span key={item} className={`h-1.5 flex-1 rounded-full ${itemIndex <= index ? "bg-sales-text-primary" : "bg-sales-border-subtle"}`} />
                ))}
              </div>
            ) : null}

            {step === "time" ? (
              <div className="mt-5">
                <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">When can you come?</h2>
                <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-sales-text-secondary">
                  {offered.length ? `${agent} held ${offered.length === 1 ? "a time" : `${offered.length} times`}. Pick one, or suggest another.` : `Suggest a time ${agent} can meet you.`}
                </p>
                {offered.length ? (
                  <div className="mt-5 grid gap-2">
                    {offered.map((item) => {
                      const selected = slotId === item;
                      const parts = formatViewingSlot(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => pickSlot(item)}
                          className={`flex min-h-14 items-center justify-between gap-3 rounded-[10px] border px-4 text-left transition-colors ${
                            selected ? "border-sales-text-primary bg-sales-surface-active" : "border-sales-border bg-sales-bg hover:bg-sales-surface-hover"
                          }`}
                        >
                          <span>
                            <span className="block text-[15px] font-semibold">{parts.time || parts.label}</span>
                            {parts.time ? <span className="mt-0.5 block text-[13px] text-sales-text-secondary">{parts.day}</span> : null}
                          </span>
                          <span className="text-[13px] font-semibold text-sales-text-muted">{selected ? "Selected" : "Choose"}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                  Another time
                  <input
                    type="datetime-local"
                    value={other}
                    onChange={(event) => {
                      setOther(event.target.value);
                      setSlotId("");
                      setError(null);
                    }}
                    className="mt-1 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[15px] text-sales-text-primary"
                  />
                </label>
                {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
                <button type="button" onClick={continueFromTime} className="mt-5 inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90">
                  Continue
                </button>
              </div>
            ) : null}

            {step === "who" ? (
              <div className="mt-5">
                <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Who is coming?</h2>
                <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-sales-text-secondary">{when}. {agent} uses this to meet you, not to start a sale.</p>
                <label className="mt-5 block text-[13px] font-medium text-sales-text-secondary">
                  Your name
                  <input
                    value={name}
                    autoComplete="name"
                    onChange={(event) => { setName(event.target.value); setError(null); }}
                    className="mt-1 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[15px] text-sales-text-primary"
                  />
                </label>
                <label className="mt-4 block text-[13px] font-medium text-sales-text-secondary">
                  Phone
                  <input
                    value={phone}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="077 000 0000"
                    onChange={(event) => { setPhone(event.target.value); setError(null); }}
                    className="mt-1 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[15px] text-sales-text-primary placeholder:text-sales-text-muted"
                  />
                </label>
                <p className="mt-4 text-[13px] font-medium text-sales-text-secondary">How many people</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {VIEWING_PARTIES.map((item) => {
                    const selected = party === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setParty(item)}
                        className={`min-h-11 rounded-[10px] border px-2 text-[13px] font-semibold transition-colors ${
                          selected ? "border-sales-text-primary bg-sales-surface-active" : "border-sales-border bg-sales-bg hover:bg-sales-surface-hover"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
                {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => go("time")} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">Back</button>
                  <button type="button" onClick={continueFromWho} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90">Continue</button>
                </div>
              </div>
            ) : null}

            {step === "confirm" ? (
              <div className="mt-5">
                <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Confirm the visit</h2>
                <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-sales-text-secondary">Read this once. An offered time is booked when you send it. A time you suggest stays a request.</p>
                <dl className="mt-5 divide-y divide-sales-border-subtle border-y border-sales-border-subtle">
                  {[
                    ["Property", heading],
                    ["Time", when],
                    ["Name", name.trim()],
                    ["Phone", phone.trim()],
                    ["Coming", party],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4 py-3">
                      <dt className="text-[13px] text-sales-text-muted">{label}</dt>
                      <dd className="text-right text-[14px] font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed text-sales-text-secondary">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => { setAgreed(event.target.checked); setError(null); }}
                    className="mt-1 h-4 w-4 accent-[var(--sales-text-primary)]"
                  />
                  I understand an offered time is booked when I send it. A time I suggest stays a request until the agency confirms it.
                </label>
                <SignaturePad onChange={(value) => { setSignature(value); setError(null); }} />
                {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => go("who")} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">Back</button>
                  <button type="button" disabled={sending} onClick={() => void send()} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 disabled:opacity-60">
                    {sending ? "Sending" : slotId ? "Confirm time" : "Send request"}
                  </button>
                </div>
              </div>
            ) : null}

            {step === "sent" ? (
              <div className="mt-1">
                <p className="text-[13px] font-medium text-sales-text-muted">{outcome === "booking" ? "Time confirmed" : "Request received"}</p>
                <h2 className="mt-2 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">
                  {outcome === "booking" ? "This time is confirmed" : `${agent} has your time`}
                </h2>
                <p className="mt-3 max-w-[42ch] text-[16px] leading-relaxed text-sales-text-secondary">
                  {when} at {heading}. {copy}
                </p>
                {outcome === "request" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStep("time");
                      setSlotId("");
                      setOther("");
                      setAgreed(false);
                      setSignature("");
                      setError(null);
                    }}
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover"
                  >
                    Try another time
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </PublicJourneyShell>
  );
}
