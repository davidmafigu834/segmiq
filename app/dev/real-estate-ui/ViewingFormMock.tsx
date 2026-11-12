"use client";

import { useState } from "react";
import { SignaturePad } from "@/components/real-estate/workflow/SignaturePad";

/* Hallmark · pre-emit critique: P4 H5 E4 S5 R4 V4
 * Genre: modern-minimal (design.md)
 * Audience: a buyer who opened an agent link
 * Use: choose a time and confirm the visit
 * Theme: locked sales tokens, lime only on the primary action
 */

const SLOTS = [
  { id: "sat-10", day: "Saturday 14 November", time: "10:00" },
  { id: "sat-1430", day: "Saturday 14 November", time: "14:30" },
  { id: "sun-11", day: "Sunday 15 November", time: "11:00" },
] as const;

const PARTIES = ["Just me", "Two of us", "A family"] as const;

function frame(body: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">${body}</svg>`)}`;
}

const PHOTOS = [
  { label: "Street", src: frame(`<rect width="800" height="500" fill="#d7cfc3"/><rect y="340" width="800" height="160" fill="#c4b8a8"/><rect x="170" y="150" width="460" height="230" fill="#efeae3"/><path d="M140 190 L400 70 L660 190" fill="#2f3a32"/><rect x="360" y="250" width="80" height="130" fill="#c8bfb2"/><rect x="230" y="210" width="70" height="55" fill="#9eb0b8"/><rect x="500" y="210" width="70" height="55" fill="#9eb0b8"/>`) },
  { label: "Living room", src: frame(`<rect width="800" height="500" fill="#efeae3"/><rect y="360" width="800" height="140" fill="#cbbfae"/><rect x="80" y="80" width="280" height="200" fill="#d5e0e4"/><rect x="420" y="250" width="280" height="110" fill="#8d9a86"/><rect x="460" y="220" width="90" height="50" fill="#efeae3"/>`) },
  { label: "Garden", src: frame(`<rect width="800" height="500" fill="#e7efe4"/><rect y="300" width="800" height="200" fill="#b7c7a4"/><circle cx="180" cy="230" r="70" fill="#6e8a62"/><rect x="168" y="280" width="24" height="70" fill="#6a5644"/><rect x="480" y="160" width="220" height="150" fill="#efeae3"/><path d="M460 190 L590 90 L720 190" fill="#2f3a32"/>`) },
];

type Step = "time" | "who" | "confirm" | "sent";

const STEPS: Step[] = ["time", "who", "confirm"];

export function ViewingFormMock() {
  const [step, setStep] = useState<Step>("time");
  const [slotId, setSlotId] = useState<string>("");
  const [other, setOther] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState<(typeof PARTIES)[number]>("Just me");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [photo, setPhoto] = useState(0);

  const chosen = SLOTS.find((item) => item.id === slotId);
  const when = chosen ? `${chosen.day} at ${chosen.time}` : other ? formatOther(other) : "";
  const index = Math.max(0, STEPS.indexOf(step));

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
    if (!when) {
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

  function send() {
    if (!agreed) {
      setError("Confirm that this time stays a request until the agency replies.");
      return;
    }
    if (!signature) {
      setError("Draw your signature to confirm.");
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
    setStep("time");
    setSlotId("");
    setOther("");
    setName("");
    setPhone("");
    setParty("Just me");
    setAgreed(false);
    setSignature("");
    setError(null);
    setSending(false);
  }

  return (
    <div className="re-in space-y-5">
      <p className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3 text-[13px] text-sales-text-secondary">
        Sample of the link a buyer opens. The times, the name, and the confirmation stay on this page. Nothing is saved.
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface lg:sticky lg:top-24">
          <div className="relative">
            <img src={PHOTOS[photo].src} alt={PHOTOS[photo].label} className="h-44 w-full object-cover lg:aspect-[16/10] lg:h-auto" />
            <div className="absolute bottom-3 left-3 flex gap-2">
              {PHOTOS.map((item, itemIndex) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={photo === itemIndex}
                  aria-label={item.label}
                  onClick={() => setPhoto(itemIndex)}
                  className={`h-10 w-14 overflow-hidden rounded-[6px] ring-2 ring-offset-1 ring-offset-transparent ${photo === itemIndex ? "ring-sales-brand" : "ring-transparent opacity-80"}`}
                >
                  <img src={item.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="border-b border-sales-border-subtle px-5 py-5">
            <p className="text-[13px] font-medium text-sales-text-muted">Nyasha Moyo sent this</p>
            <h1 className="mt-2 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">2 Baines Avenue</h1>
            <p className="mt-2 text-[15px] text-sales-text-secondary">Avondale, Harare. A house for sale.</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-5">
            {[
              ["Asking", "US$185,000"],
              ["Beds", "4"],
              ["Baths", "2"],
              ["Size", "220 m²"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[12px] text-sales-text-muted">{label}</dt>
                <dd className="mt-0.5 text-[16px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-sales-border-subtle px-5 py-4 text-[13px] leading-relaxed text-sales-text-secondary">
            Quiet avenue, garden at the back. Nyasha meets you at the gate. Bring an ID if you want the viewing noted on the file.
          </p>
        </aside>

        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-5 py-5" aria-live="polite">
          {step !== "sent" ? (
            <div className="flex items-center gap-2" aria-label={`Part ${index + 1} of 3`}>
              {STEPS.map((item, itemIndex) => (
                <span
                  key={item}
                  className={`h-1.5 flex-1 rounded-full ${itemIndex <= index ? "bg-sales-text-primary" : "bg-sales-border-subtle"}`}
                />
              ))}
            </div>
          ) : null}

          {step === "time" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">When can you come?</h2>
              <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-sales-text-secondary">Nyasha held three times. Pick one, or suggest another.</p>
              <div className="mt-5 grid gap-2">
                {SLOTS.map((item) => {
                  const selected = slotId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => pickSlot(item.id)}
                      className={`flex min-h-14 items-center justify-between gap-3 rounded-[10px] border px-4 text-left transition-colors ${
                        selected
                          ? "border-sales-text-primary bg-sales-surface-active"
                          : "border-sales-border bg-sales-bg hover:bg-sales-surface-hover"
                      }`}
                    >
                      <span>
                        <span className="block text-[15px] font-semibold">{item.time}</span>
                        <span className="mt-0.5 block text-[13px] text-sales-text-secondary">{item.day}</span>
                      </span>
                      <span className="text-[13px] font-semibold text-sales-text-muted">{selected ? "Selected" : "Choose"}</span>
                    </button>
                  );
                })}
              </div>
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
              <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-sales-text-secondary">{when}. Nyasha uses this to meet you, not to start a sale.</p>
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
                {PARTIES.map((item) => {
                  const selected = party === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setParty(item)}
                      className={`min-h-11 rounded-[10px] border px-2 text-[13px] font-semibold transition-colors ${
                        selected
                          ? "border-sales-text-primary bg-sales-surface-active"
                          : "border-sales-border bg-sales-bg hover:bg-sales-surface-hover"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => go("time")} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
                  Back
                </button>
                <button type="button" onClick={continueFromWho} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90">
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="mt-5">
              <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">Confirm the visit</h2>
              <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-sales-text-secondary">Read this once. A request is not a booking until Nyasha replies.</p>
              <dl className="mt-5 divide-y divide-sales-border-subtle border-y border-sales-border-subtle">
                {[
                  ["Property", "2 Baines Avenue, Avondale"],
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
                I understand this time is a request until the agency confirms it.
              </label>
              <SignaturePad
                onChange={(value) => { setSignature(value); setError(null); }}
              />
              {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => go("who")} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
                  Back
                </button>
                <button type="button" disabled={sending} onClick={send} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 disabled:opacity-60">
                  {sending ? "Sending" : "Send request"}
                </button>
              </div>
            </div>
          ) : null}

          {step === "sent" ? (
            <div className="mt-1">
              <p className="text-[13px] font-medium text-sales-text-muted">Request received</p>
              <h2 className="mt-2 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">Nyasha has your time</h2>
              <p className="mt-3 max-w-[42ch] text-[16px] leading-relaxed text-sales-text-secondary">
                {when} at 2 Baines Avenue. This stays a request until Nyasha confirms it on {phone.trim()}.
              </p>
              <button type="button" onClick={reset} className="mt-6 inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
                Try another time
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function formatOther(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
