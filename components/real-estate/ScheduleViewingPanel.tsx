"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check } from "lucide-react";
import {
  CALLBACK_SCHEDULE_LABELS,
  CALLBACK_SCHEDULE_OPTIONS,
  resolveCallbackAt,
  type CallbackScheduleOption,
} from "@/lib/call-log-constants";
import { listingLabel } from "@/lib/real-estate/helpers";

type ListingOption = {
  id: string;
  address: string | null;
  suburb: string | null;
  external_reference?: string | null;
};

type ViewingRow = {
  id: string;
  listing_id: string;
  scheduled_at: string;
  status: string;
  feedback_text: string | null;
  feedback_sentiment: string | null;
  listing?: ListingOption | null;
};

function todayLocalISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/**
 * Schedule viewing — reuses the same schedule presets as LogCallForm follow-ups.
 * Pass `embedded` + `defaultOpen` to mount inline inside Log Call without the
 * full Viewings list chrome.
 */
export function ScheduleViewingPanel({
  clientId,
  contactId,
  interestedListingIds = [],
  defaultListingId,
  embedded = false,
  defaultOpen = false,
  onScheduled,
  onCancel,
}: {
  clientId: string;
  contactId: string;
  interestedListingIds?: string[];
  /** Prefill listing (e.g. from Log Call "Which property?"). */
  defaultListingId?: string | null;
  /** Compact form only — no heading / viewing history. */
  embedded?: boolean;
  defaultOpen?: boolean;
  onScheduled?: (info: { scheduledAt: string; listingId: string }) => void;
  onCancel?: () => void;
}) {
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [open, setOpen] = useState(defaultOpen || embedded);
  const [listingId, setListingId] = useState(defaultListingId ?? "");
  const [scheduleOption, setScheduleOption] = useState<CallbackScheduleOption | "">("");
  const [customCallback, setCustomCallback] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSentiment, setFeedbackSentiment] = useState<"positive" | "neutral" | "negative" | "">("");

  const scheduledAt = useMemo(() => {
    if (!scheduleOption) return null;
    if (scheduleOption === "pick" && !customCallback.trim()) return null;
    return resolveCallbackAt(scheduleOption, customCallback || undefined)?.toISOString() ?? null;
  }, [scheduleOption, customCallback]);

  async function load() {
    const [listRes, viewRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/listings`),
      fetch(`/api/clients/${clientId}/viewings?contact_id=${contactId}`),
    ]);
    const listJson = (await listRes.json()) as { listings?: ListingOption[] };
    const viewJson = (await viewRes.json()) as { viewings?: ViewingRow[] };
    const all = listJson.listings ?? [];
    setListings(all);
    setViewings(viewJson.viewings ?? []);

    const interested = interestedListingIds.filter((id) => all.some((l) => l.id === id));
    if (defaultListingId && all.some((l) => l.id === defaultListingId)) {
      setListingId(defaultListingId);
    } else if (interested.length === 1) {
      setListingId(interested[0]);
    } else if (all.length === 1) {
      setListingId(all[0].id);
    }
  }

  useEffect(() => {
    void load();
  }, [clientId, contactId, defaultListingId]);

  useEffect(() => {
    if (defaultListingId) setListingId(defaultListingId);
  }, [defaultListingId]);

  useEffect(() => {
    if (embedded || defaultOpen) setOpen(true);
  }, [embedded, defaultOpen]);

  async function schedule() {
    if (!listingId || !scheduledAt) {
      setToast("Pick a property and time");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/viewings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          listing_id: listingId,
          scheduled_at: scheduledAt,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setToast(j.error ?? "Failed");
        return;
      }
      setOpen(false);
      setScheduleOption("");
      setCustomCallback("");
      setToast("Viewing scheduled");
      onScheduled?.({ scheduledAt, listingId });
      if (!embedded) await load();
    } finally {
      setSaving(false);
    }
  }

  async function markCompleted(viewingId: string) {
    setFeedbackFor(viewingId);
    setFeedbackText("");
    setFeedbackSentiment("");
  }

  async function saveCompleted() {
    if (!feedbackFor) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/viewings?id=${feedbackFor}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          feedback_text: feedbackText.trim() || null,
          feedback_sentiment: feedbackSentiment || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setToast(j.error ?? "Failed");
        return;
      }
      setFeedbackFor(null);
      setToast("Viewing completed");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const listingChoices =
    interestedListingIds.length > 0
      ? listings.filter((l) => interestedListingIds.includes(l.id))
      : listings;
  const dropdownListings = listingChoices.length > 0 ? listingChoices : listings;

  const formBlock = open ? (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-4">
      <label className="block text-sm">
        <span className="text-ink-secondary">Property</span>
        <select
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
        >
          <option value="">Select…</option>
          {dropdownListings.map((l) => (
            <option key={l.id} value={l.id}>
              {listingLabel(l)}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
          When
        </span>
        <div className="flex flex-wrap gap-2">
          {CALLBACK_SCHEDULE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setScheduleOption(opt)}
              className={[
                "rounded-full border px-3 py-1.5 text-[13px]",
                scheduleOption === opt
                  ? "border-[var(--accent-border)] bg-[var(--accent-muted)]"
                  : "border-[var(--border)] text-ink-secondary",
              ].join(" ")}
            >
              {CALLBACK_SCHEDULE_LABELS[opt]}
            </button>
          ))}
        </div>
        {scheduleOption === "pick" ? (
          <input
            type="datetime-local"
            min={`${todayLocalISO()}T00:00`}
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2"
            value={customCallback}
            onChange={(e) => setCustomCallback(e.target.value)}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={saving || !listingId || !scheduledAt}
          onClick={() => void schedule()}
        >
          {saving ? "Saving…" : "Confirm viewing"}
        </button>
        {embedded && onCancel ? (
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-[13px] text-ink-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
      {toast ? <p className="text-sm text-ink-secondary">{toast}</p> : null}
    </div>
  ) : null;

  if (embedded) {
    return <div className="ag-fade-in space-y-2">{formBlock}</div>;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl">Viewings</h3>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-1.5 text-sm"
          onClick={() => setOpen((v) => !v)}
        >
          <CalendarPlus className="h-4 w-4" />
          Schedule viewing
        </button>
      </div>

      {toast && !open ? <p className="text-sm text-ink-secondary">{toast}</p> : null}

      {formBlock}

      <ul className="space-y-2">
        {viewings.length === 0 ? (
          <li className="text-sm text-ink-tertiary">No viewings scheduled.</li>
        ) : (
          viewings.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{listingLabel(v.listing ?? { address: null, suburb: null })}</p>
                <p className="text-ink-secondary">
                  {new Date(v.scheduled_at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {v.status}
                </p>
              </div>
              {v.status === "scheduled" ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs"
                  onClick={() => void markCompleted(v.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark completed
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {feedbackFor ? (
        <div className="space-y-3 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)]/20 p-4">
          <p className="text-sm font-medium">How did the viewing go?</p>
          <div className="flex flex-wrap gap-2">
            {(["positive", "neutral", "negative"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFeedbackSentiment(s)}
                className={[
                  "rounded-full border px-3 py-1 text-xs capitalize",
                  feedbackSentiment === s
                    ? "border-[var(--accent-border)] bg-[var(--accent-muted)]"
                    : "border-[var(--border)]",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            placeholder="Optional notes…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveCompleted()}>
              Save
            </button>
            <button
              type="button"
              className="btn-ghost border border-[var(--border)]"
              onClick={async () => {
                if (!feedbackFor) return;
                setSaving(true);
                try {
                  await fetch(`/api/clients/${clientId}/viewings?id=${feedbackFor}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "completed" }),
                  });
                  setFeedbackFor(null);
                  setToast("Viewing completed");
                  await load();
                } finally {
                  setSaving(false);
                }
              }}
            >
              Skip feedback
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
