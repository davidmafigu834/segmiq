"use client";

import { useEffect, useState, type FormEvent } from "react";
import { solarFollowUpWrite } from "@/lib/sales/solar-workflow/engagement";
import { limeBtn } from "./desk";

export function SolarLeadWork({
  leadId,
  followUpDate,
  onSaved,
}: {
  leadId: string;
  followUpDate: string | null;
  onSaved?: () => void;
}) {
  const [reminder, setReminder] = useState(followUpDate?.slice(0, 10) ?? "");
  const [dealId, setDealId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reminder" | "note" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/sales/solar-workflow/lead?leadId=${encodeURIComponent(leadId)}`)
      .then((res) => res.json())
      .then((json: { card?: { reminderAt?: string | null; dealId?: string | null } | null }) => {
        if (cancelled || !json.card) return;
        setDealId(json.card.dealId ?? null);
        if (json.card.reminderAt) setReminder(json.card.reminderAt.slice(0, 10));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function saveReminder(event: FormEvent) {
    event.preventDefault();
    setBusy("reminder");
    setError(null);
    setStatus(null);
    const write = reminder ? solarFollowUpWrite(dealId, reminder) : null;
    const res = write?.resource === "deal"
      ? await fetch(`/api/deals/${dealId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(write.body),
        })
      : dealId
        ? await fetch(`/api/deals/${dealId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ next_action_at: null }),
          }).then(async (dealRes) => {
            if (!dealRes.ok) return dealRes;
            return fetch(`/api/leads/${leadId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ follow_up_date: null }),
            });
          })
        : await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ follow_up_date: reminder || null }),
          });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setError(json.error || "Could not save the reminder.");
      return;
    }
    setStatus(reminder ? "Reminder saved. The stage stays the same." : "Reminder cleared.");
    onSaved?.();
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    const text = note.trim();
    if (!text) {
      setError("Write a note.");
      setStatus(null);
      return;
    }
    setBusy("note");
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/leads/${leadId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: text }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setError(json.error || "Could not save the note.");
      return;
    }
    setNote("");
    setStatus("Note saved.");
    onSaved?.();
  }

  return (
    <div>
      <form onSubmit={(event) => void saveReminder(event)} className="so-form">
        <label className="so-label" htmlFor={`solar-reminder-${leadId}`}>
          Reminder
          <span className="so-hint">One date. It shows on Today and does not move the stage.</span>
          <input
            id={`solar-reminder-${leadId}`}
            type="date"
            value={reminder}
            onChange={(event) => setReminder(event.target.value)}
            className="so-field"
          />
        </label>
        <div className="so-form-actions">
          <button type="submit" className={limeBtn} disabled={busy != null && busy !== "reminder"}>{busy === "reminder" ? "Saving…" : "Save reminder"}</button>
        </div>
      </form>
      <form onSubmit={(event) => void saveNote(event)} className="so-form">
        <label className="so-label" htmlFor={`solar-note-${leadId}`}>
          Note
          <span className="so-hint">A note records what you learned. It does not change the stage.</span>
          <textarea
            id={`solar-note-${leadId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="so-field"
            placeholder="Write what you learned"
          />
        </label>
        <div className="so-form-actions">
          <button type="submit" className={limeBtn} disabled={busy != null && busy !== "note"}>{busy === "note" ? "Saving…" : "Save note"}</button>
        </div>
      </form>
      {error ? <p className="so-alert" role="alert">{error}</p> : null}
      {status ? <p className="text-[13px] text-sales-text-secondary" role="status">{status}</p> : null}
    </div>
  );
}
