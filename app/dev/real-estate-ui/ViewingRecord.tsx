"use client";

import { useState } from "react";

export type ViewingStatus = "scheduled" | "recorded" | "cancelled";

export function ViewingRecord({
  name,
  place,
  when,
  phone,
  status,
  note,
  onClose,
  onSave,
  onCancel,
}: {
  name: string;
  place: string;
  when: string;
  phone?: string;
  status: ViewingStatus;
  note: string;
  onClose: () => void;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState(note);

  const headline = status === "cancelled" ? "Cancelled" : status === "recorded" ? "Outcome recorded" : "Scheduled";
  const line = status === "cancelled"
    ? `The viewing with ${name} at ${place} is cancelled.`
    : status === "recorded"
      ? `${name} has seen ${place}.`
      : `${name} is booked to see ${place}.`;

  return (
    <div className="re-in space-y-5">
      <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
        Back
      </button>
      <header className="re-head flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">Viewing</p>
          <h1 className="mt-1 break-words font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{name}</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{place}</p>
          <p className="mt-1 text-[13px] text-sales-text-muted">{when}</p>
        </div>
        <div className="re-actions flex gap-2">
          <button type="button" className="inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
            Call
          </button>
          <button type="button" className="inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
            WhatsApp
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{headline}</h2>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{line}</p>
        </div>
        <dl className="grid gap-x-6 gap-y-3 border-t border-sales-border-subtle px-4 py-3 sm:grid-cols-2">
          {[
            ["Buyer", name],
            ["Phone", phone || "Not recorded"],
            ["Property", place],
            ["When", when],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[12px] text-sales-text-muted">{label}</dt>
              <dd className="text-[14px] font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {status === "recorded" && note ? (
          <div className="border-t border-sales-border-subtle px-4 py-3">
            <p className="text-[12px] text-sales-text-muted">What happened</p>
            <p className="mt-1 text-[14px] text-sales-text-secondary">{note}</p>
          </div>
        ) : null}
        {status === "scheduled" ? (
          <div className="re-actions re-stack flex flex-wrap gap-2 border-t border-sales-border-subtle px-4 py-4">
            {writing ? (
              <form
                className="w-full"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSave(draft.trim());
                  setWriting(false);
                }}
              >
                <label className="block">
                  <span className="text-[13px] font-medium">What happened</span>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2 text-[14px]"
                  />
                </label>
                <div className="re-actions mt-3 flex gap-2">
                  <button type="submit" className="h-11 rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface">
                    Save
                  </button>
                  <button type="button" onClick={() => setWriting(false)} className="h-11 rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
                    Close
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button type="button" onClick={() => setWriting(true)} className="h-11 rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface">
                  Record the outcome
                </button>
                <button type="button" onClick={onCancel} className="h-11 rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
                  Cancel the viewing
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
