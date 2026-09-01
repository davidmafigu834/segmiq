"use client";

import { useState } from "react";
import { PhoneCall, StickyNote } from "lucide-react";
import {
  Button,
  Checkbox,
  FieldError,
  FilteredEmptyState,
  SearchInput,
  TextArea,
  useSalesToast,
} from "@/components/sales/ui";
import { ACTIVITY_FILTER_OPTIONS } from "@/lib/activity/presentation";
import type { ActivityFilterCategory } from "@/lib/activity/types";
import { cn } from "@/lib/ui/cn";

type ComposerTab = "note" | "call";

export function ActivityComposer({
  leadId,
  onSaved,
  showCallLog = true,
  className,
}: {
  leadId: string;
  onSaved?: () => void;
  showCallLog?: boolean;
  className?: string;
}) {
  const { toast } = useSalesToast();
  const [tab, setTab] = useState<ComposerTab>("note");
  const [note, setNote] = useState("");
  const [pinToTop, setPinToTop] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveNote() {
    const text = note.trim();
    if (!text) {
      setError("Enter a note before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/internal-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text, pinToTop }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save note");
      }
      setNote("");
      setPinToTop(false);
      toast({ tone: "success", title: "Note added", description: "Timeline updated." });
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  }

  async function logNoAnswerCall() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/log-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reachOutcome: "no_answer",
          notes: callNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not log call");
      }
      setCallNotes("");
      toast({ tone: "success", title: "Call logged", description: "Timeline updated." });
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log call");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: ComposerTab; label: string; icon: typeof StickyNote }[] = [
    { id: "note", label: "Note", icon: StickyNote },
  ];
  if (showCallLog) tabs.push({ id: "call", label: "Call", icon: PhoneCall });

  return (
    <section className={cn("rounded-[12px] border border-sales-border bg-sales-surface-subtle p-3", className)}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition-colors",
                active
                  ? "bg-sales-brand text-sales-brand-text"
                  : "text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
              )}
            >
              <Icon size={14} strokeWidth={1.8} aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "note" ? (
        <div className="space-y-3">
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an internal note…"
            rows={3}
            maxLength={2000}
            className="text-base sm:text-[13px]"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "composer-error" : undefined}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Checkbox
              checked={pinToTop}
              onCheckedChange={(v) => setPinToTop(Boolean(v))}
              label="Pin to top"
            />
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void saveNote()}>
              {busy ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-sales-text-secondary">
            Log a quick no-answer call. For full outcomes (reached, follow-up, won/lost), use the call logger.
          </p>
          <TextArea
            value={callNotes}
            onChange={(e) => setCallNotes(e.target.value)}
            placeholder="Optional call notes…"
            rows={2}
            className="text-base sm:text-[13px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={`/sales/call-now?lead=${leadId}`}
              className="inline-flex h-9 items-center justify-center rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
            >
              Open full call logger
            </a>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void logNoAnswerCall()}>
              {busy ? "Saving…" : "Log no-answer call"}
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <FieldError id="composer-error">{error}</FieldError>
      ) : null}
    </section>
  );
}

export function ActivityTimelineFilters({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  onClearFilters,
}: {
  filter: ActivityFilterCategory;
  onFilterChange: (f: ActivityFilterCategory) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onClearFilters: () => void;
}) {
  const hasFilters = filter !== "all" || search.trim().length > 0;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-0.5">
        {ACTIVITY_FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onFilterChange(opt.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "border-sales-brand bg-sales-brand-soft text-sales-brand-fg"
                  : "border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:max-w-[240px]">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search timeline…"
          className="min-w-0 flex-1"
          aria-label="Search timeline"
        />
        {hasFilters ? (
          <button
            type="button"
            className="shrink-0 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
            onClick={onClearFilters}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityTimelineEmpty({
  filtered,
  onClearFilters,
}: {
  filtered: boolean;
  onClearFilters?: () => void;
}) {
  if (filtered) {
    return (
      <FilteredEmptyState
        size="compact"
        title="No activity matches these filters"
        description="Try another category or clear filters."
        onClearFilters={onClearFilters}
      />
    );
  }
  return (
    <FilteredEmptyState
      size="compact"
      title="No activity yet"
      description="Notes, calls, WhatsApp messages, and stage changes will appear here as they happen."
    />
  );
}
