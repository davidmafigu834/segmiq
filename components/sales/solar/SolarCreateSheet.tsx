"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { limeBtn, lineBtn } from "./desk";
import "./solar-desk.css";

const NEEDS = ["Backup", "Grid-tie", "Not sure"];
const SOURCES = ["WhatsApp", "Phone", "Walk-in", "Referral"];

export function SolarCreateSheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [need, setNeed] = useState(NEEDS[0]);
  const [source, setSource] = useState(SOURCES[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Enter a name.");
      return;
    }
    if (phone.trim().length < 6) {
      setError("Enter a phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    const notes = [note.trim(), address.trim() ? `Address: ${address.trim()}` : ""].filter(Boolean).join("\n");
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lead",
        name: name.trim(),
        phone: phone.trim(),
        source,
        projectType: need,
        notes: notes || undefined,
        initialStatus: "NEW",
        ...(source === "Walk-in" ? { intakeOutcome: "still_deciding" } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not add the lead.");
      return;
    }
    onSuccess();
  }

  return (
    <>
      <button type="button" className="so-sheet-back" aria-label="Close form" onClick={onClose} />
      <aside className="so-sheet" role="dialog" aria-modal="true" aria-label="New lead">
        <form className="so-sheet-scroll" onSubmit={(event) => void save(event)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-sales-text-muted">Solar installation</p>
              <h2 className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.03em]">New lead</h2>
              <p className="mt-2 text-[14px] text-sales-text-secondary">Name and phone are enough to start. A reminder and a visit come after.</p>
            </div>
            <button type="button" className={`${lineBtn} inline-flex w-9 items-center justify-center px-0`} onClick={onClose} aria-label="Close">
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="so-form">
            <label className="so-label">
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} className="so-field" autoFocus />
            </label>
            <label className="so-label">
              Phone
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="so-field" inputMode="tel" placeholder="077 000 0000" />
            </label>
            <label className="so-label">
              Address
              <span className="so-hint">Optional. The site visit uses it later.</span>
              <input value={address} onChange={(event) => setAddress(event.target.value)} className="so-field" />
            </label>
            <fieldset>
              <legend className="so-label">What they need</legend>
              <div className="so-choices">
                {NEEDS.map((item) => (
                  <button key={item} type="button" className={`so-choice ${need === item ? "is-on" : ""}`} aria-pressed={need === item} onClick={() => setNeed(item)}>{item}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="so-label">Source</legend>
              <div className="so-choices">
                {SOURCES.map((item) => (
                  <button key={item} type="button" className={`so-choice ${source === item ? "is-on" : ""}`} aria-pressed={source === item} onClick={() => setSource(item)}>{item}</button>
                ))}
              </div>
            </fieldset>
            <label className="so-label">
              Note
              <span className="so-hint">Optional. A note does not change the stage.</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} className="so-field" />
            </label>
            {error ? <p className="so-alert" role="alert">{error}</p> : null}
            <div className="so-form-actions">
              <button type="submit" className={limeBtn} disabled={busy}>{busy ? "Adding…" : "Add lead"}</button>
              <button type="button" className={lineBtn} onClick={onClose}>Close</button>
            </div>
          </div>
        </form>
      </aside>
    </>
  );
}
