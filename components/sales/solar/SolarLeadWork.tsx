"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/sales/ui";
import { solarFollowUpWrite } from "@/lib/sales/solar-workflow/engagement";

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
    <div className="space-y-3">
      <form onSubmit={(event) => void saveReminder(event)} className="rounded-[12px] border border-sales-border bg-sales-surface p-3">
        <label className="block text-[13px] font-medium text-sales-text-primary" htmlFor={`solar-reminder-${leadId}`}>
          Reminder
        </label>
        <p className="mt-1 text-[12px] text-sales-text-secondary">One date. It shows on Today and does not move the stage.</p>
        <input
          id={`solar-reminder-${leadId}`}
          type="date"
          value={reminder}
          onChange={(event) => setReminder(event.target.value)}
          className="mt-2 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]"
        />
        <Button type="submit" variant="primary" size="md" className="mt-3" loading={busy === "reminder"} disabled={busy != null && busy !== "reminder"}>
          Save reminder
        </Button>
      </form>
      <form onSubmit={(event) => void saveNote(event)} className="rounded-[12px] border border-sales-border bg-sales-surface p-3">
        <label className="block text-[13px] font-medium text-sales-text-primary" htmlFor={`solar-note-${leadId}`}>
          Note
        </label>
        <textarea
          id={`solar-note-${leadId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2 text-[14px]"
          placeholder="What you learned"
        />
        <Button type="submit" variant="secondary" size="md" className="mt-3" loading={busy === "note"} disabled={busy != null && busy !== "note"}>
          Save note
        </Button>
      </form>
      {error ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {status ? <p className="text-[13px] text-sales-text-secondary" role="status">{status}</p> : null}
    </div>
  );
}
