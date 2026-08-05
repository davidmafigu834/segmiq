"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check, Star } from "lucide-react";
import type { CallOutcome, LeadRow } from "@/types";
import {
  CALLBACK_SCHEDULE_LABELS,
  CALLBACK_SCHEDULE_OPTIONS,
  CALL_RESULT_LABELS,
  CALL_RESULTS,
  DIRECT_SEND_ASSET_TYPES,
  REACH_OUTCOME_LABELS,
  REACH_OUTCOMES,
  deriveLegacyOutcome,
  getAssetRequestOptions,
  getFollowUpHoldupReasons,
  getLostReasons,
  getNotQualifiedReasons,
  resolveCallbackAt,
  type AssetRequestKey,
  type CallResult,
  type CallbackScheduleOption,
  type ReachOutcome,
  type SendAssetType,
} from "@/lib/call-log-constants";
import { ScheduleViewingPanel } from "@/components/real-estate/ScheduleViewingPanel";

function todayLocalISO(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 1,
  className = "",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const gridClass =
    columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className={className}>
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
        {label}
      </span>
      <div
        className={`grid ${gridClass} overflow-hidden rounded-lg border border-[var(--border)] divide-x divide-y divide-[var(--border)]`}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "min-h-[44px] px-3 py-2.5 text-sm transition-all touch-manipulation sm:min-h-0",
                active
                  ? "bg-[var(--accent-muted)] font-medium text-[var(--text-primary)]"
                  : "bg-[var(--surface-card)] text-ink-secondary hover:bg-[var(--bg-tertiary)] hover:text-ink-primary",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReasonPills({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="ag-fade-in space-y-2">
      <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? "" : opt)}
              className={[
                "rounded-full border px-3 py-1.5 text-[13px] transition-all touch-manipulation",
                active
                  ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--status-won-fg)]"
                  : "border-[var(--border)] text-ink-secondary hover:border-[var(--border-hover)] hover:text-ink-primary",
              ].join(" ")}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-xs text-ink-tertiary">{hint}</p> : null}
    </div>
  );
}

export type LogCallFormProps = {
  leadId: string;
  magicToken?: string | null;
  defaultChannel?: "call" | "whatsapp";
  onMagicSubmitSuccess?: (ctx: {
    outcome: CallOutcome;
    lead: LeadRow;
    followUpDate: string | null;
    dealValue: number | null;
    notes: string;
  }) => void;
  onLogged?: () => void;
  onSubmitSuccess?: () => void;
  onLeadUpdated?: (lead: LeadRow) => void;
  onOpenSendTab?: (assetTypes: SendAssetType[]) => void;
  variant?: "panel" | "magic" | "compact";
  /** When real_estate, require which property was discussed. */
  businessType?: "trades" | "real_estate";
  clientId?: string | null;
  /** Contact for RE viewing schedule / similar-listings send. */
  contactId?: string | null;
  /** Preloaded interested listing ids for the contact (optional). */
  interestedListingIds?: string[];
};

export function LogCallForm({
  leadId,
  magicToken,
  defaultChannel = "call",
  onMagicSubmitSuccess,
  onLogged,
  onSubmitSuccess,
  onLeadUpdated,
  onOpenSendTab,
  variant = "panel",
  businessType = "trades",
  clientId = null,
  contactId: contactIdProp = null,
  interestedListingIds = [],
}: LogCallFormProps) {
  const [reachOutcome, setReachOutcome] = useState<ReachOutcome>("reached");
  const [result, setResult] = useState<CallResult | null>(null);
  const [reason, setReason] = useState("");
  const [scheduleOption, setScheduleOption] = useState<CallbackScheduleOption | "">("");
  const [customCallback, setCustomCallback] = useState("");
  const [assetsRequested, setAssetsRequested] = useState<AssetRequestKey[]>([]);
  const [convertLater, setConvertLater] = useState(false);
  const [noAnswerCount, setNoAnswerCount] = useState(0);
  const [directSending, setDirectSending] = useState(false);
  const [listingId, setListingId] = useState("");
  const [listings, setListings] = useState<
    { id: string; address: string | null; suburb: string | null }[]
  >([]);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [addingProperty, setAddingProperty] = useState(false);
  const [newListingId, setNewListingId] = useState("");
  const [resolvedContactId, setResolvedContactId] = useState<string | null>(contactIdProp);
  const [viewingOpen, setViewingOpen] = useState(false);
  const [viewingBookedLabel, setViewingBookedLabel] = useState<string | null>(null);

  const isRealEstate = businessType === "real_estate";
  const stallReasons = useMemo(() => getFollowUpHoldupReasons(businessType), [businessType]);
  const lostReasons = useMemo(() => getLostReasons(businessType), [businessType]);
  const notQualifiedReasons = useMemo(() => getNotQualifiedReasons(businessType), [businessType]);
  const assetOptions = useMemo(() => getAssetRequestOptions(businessType), [businessType]);

  const [reasonError, setReasonError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [channel, setChannel] = useState<"call" | "whatsapp">(defaultChannel);

  const isMagic = variant === "magic";
  const isCompact = variant === "compact";

  useEffect(() => {
    setChannel(defaultChannel);
  }, [defaultChannel, leadId]);

  useEffect(() => {
    setResolvedContactId(contactIdProp);
  }, [contactIdProp, leadId]);

  useEffect(() => {
    if (contactIdProp || !leadId) return;
    let cancelled = false;
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((d: { lead?: { contact_id?: string | null } }) => {
        if (!cancelled && d.lead?.contact_id) {
          setResolvedContactId(d.lead.contact_id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leadId, contactIdProp]);

  useEffect(() => {
    setAssetsRequested([]);
    setViewingOpen(false);
    setViewingBookedLabel(null);
  }, [businessType, leadId]);

  useEffect(() => {
    if (!isRealEstate || !clientId) return;
    let cancelled = false;
    fetch(`/api/clients/${clientId}/listings`)
      .then((r) => r.json())
      .then((j: { listings?: { id: string; address: string | null; suburb: string | null }[] }) => {
        if (cancelled) return;
        const all = j.listings ?? [];
        setListings(all);
        const interested = interestedListingIds.filter((id) => all.some((l) => l.id === id));
        if (interested.length === 1) setListingId(interested[0]);
        else if (all.length === 1) setListingId(all[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isRealEstate, clientId, leadId, interestedListingIds.join(",")]);

  useEffect(() => {
    if (isCompact) return;
    try {
      const key = `log:channel:${leadId}`;
      const v = window.localStorage.getItem(key);
      if (v === "whatsapp") {
        setChannel("whatsapp");
        window.localStorage.removeItem(key);
      }
    } catch {}
  }, [leadId, isCompact]);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    fetch(`/api/leads/${leadId}/call-logs`)
      .then((r) => r.json())
      .then((d: { noAnswerCount?: number }) => {
        if (!cancelled) setNoAnswerCount(d.noAnswerCount ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leadId, savedToast]);

  useEffect(() => {
    if (reachOutcome !== "reached") {
      setResult(null);
      setAssetsRequested([]);
      setViewingOpen(false);
    }
    if (reachOutcome !== "reached" || result !== "follow_up") {
      setConvertLater(false);
    }
    if (reachOutcome === "reached" && result !== "follow_up" && result !== "won") {
      setViewingOpen(false);
    }
    if (reachOutcome === "no_answer") {
      setReason("");
      setScheduleOption("");
      setCustomCallback("");
    }
    setReasonError(null);
    setScheduleError(null);
  }, [reachOutcome, result]);

  const needsSchedule =
    (reachOutcome === "reached" && result === "follow_up") || reachOutcome === "call_back";

  const callbackAtIso = useMemo(() => {
    if (!needsSchedule || !scheduleOption) return null;
    if (scheduleOption === "pick" && !customCallback.trim()) return null;
    const at = resolveCallbackAt(
      scheduleOption,
      scheduleOption === "pick" ? customCallback : null
    );
    return at.toISOString();
  }, [needsSchedule, scheduleOption, customCallback]);

  const selectedSendTypes = useMemo(() => {
    const types: SendAssetType[] = [];
    for (const key of assetsRequested) {
      const sendType = assetOptions.find((o) => o.key === key)?.sendType;
      if (
        sendType === "PORTFOLIO" ||
        sendType === "PROJECT" ||
        sendType === "PRICING_PACKAGE" ||
        sendType === "TESTIMONIALS" ||
        sendType === "DOCUMENT"
      ) {
        if (!types.includes(sendType)) types.push(sendType);
      }
    }
    return types;
  }, [assetsRequested, assetOptions]);

  const wantsSimilarListings = assetsRequested.includes("similar_listings");

  const canDirectSendOnly =
    !wantsSimilarListings &&
    selectedSendTypes.length > 0 &&
    selectedSendTypes.every((t) => DIRECT_SEND_ASSET_TYPES.has(t));

  const effectiveListingId = addingProperty ? newListingId : listingId;
  const showScheduleViewing =
    isRealEstate &&
    reachOutcome === "reached" &&
    (result === "follow_up" || result === "won") &&
    Boolean(clientId && resolvedContactId);

  const fieldZoomClass =
    isMagic || isCompact ? "text-base sm:text-sm" : "text-[16px] sm:text-sm";
  const formSpaceClass = isCompact ? "space-y-3" : "space-y-4";
  const minPickDate = todayLocalISO();

  function toggleAsset(key: AssetRequestKey) {
    setAssetsRequested((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function directSendPortfolioTestimonials() {
    if (!canDirectSendOnly || directSending) return;
    setDirectSending(true);
    try {
      for (const type of selectedSendTypes) {
        if (!DIRECT_SEND_ASSET_TYPES.has(type)) continue;
        await fetch(`/api/leads/${leadId}/send-asset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetType: type }),
        });
      }
      const leadRes = await fetch(`/api/leads/${leadId}`);
      if (leadRes.ok) {
        const data = (await leadRes.json()) as { lead?: LeadRow };
        if (data.lead) onLeadUpdated?.(data.lead);
      }
      onLogged?.();
    } finally {
      setDirectSending(false);
    }
  }

  async function sendSimilarListings() {
    if (!clientId || !resolvedContactId || !effectiveListingId || directSending) return;
    setDirectSending(true);
    try {
      await fetch(`/api/clients/${clientId}/listings/${effectiveListingId}/send-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: resolvedContactId }),
      });
      onLogged?.();
    } finally {
      setDirectSending(false);
    }
  }

  function validate(): boolean {
    setReasonError(null);
    setScheduleError(null);
    setFormError(null);
    setPropertyError(null);

    if (isRealEstate) {
      const effective = addingProperty ? newListingId : listingId;
      if (!effective) {
        setPropertyError("Please select which property this call was about");
        return false;
      }
    }

    if (reachOutcome === "reached") {
      if (!result) {
        setFormError("Please select the call result");
        return false;
      }
      if (result === "lost" || result === "not_qualified" || result === "follow_up") {
        if (!reason.trim()) {
          setReasonError("Please select a reason");
          return false;
        }
      }
      if (result === "follow_up") {
        if (!callbackAtIso) {
          setScheduleError("Please schedule when to follow up");
          return false;
        }
      }
    }

    if (reachOutcome === "call_back") {
      if (!callbackAtIso) {
        setScheduleError("Please schedule when to call back");
        return false;
      }
    }

    return true;
  }

  return (
    <form
      className={
        isMagic
          ? `min-w-0 max-w-full ${formSpaceClass}`
          : `${formSpaceClass} ag-fade-in`
      }
      onSubmit={async (e) => {
        e.preventDefault();
        if (!validate()) return;

        const fd = new FormData(e.currentTarget);
        const notes = (fd.get("notes") as string) ?? "";

        const body: Record<string, unknown> = {
          reachOutcome,
          result: reachOutcome === "reached" ? result : null,
          reason: reason.trim() || null,
          callbackAt: callbackAtIso,
          assetsRequested: assetsRequested.length ? assetsRequested : null,
          notes,
          channel,
          isConvertLaterPick: convertLater,
          convertLaterNote:
            convertLater && reason.trim() ? reason.trim() : convertLater ? notes.trim() || null : null,
        };

        if (isRealEstate) {
          const effective = addingProperty ? newListingId : listingId;
          body.listingId = effective || null;
          if (addingProperty && newListingId) body.addListingId = newListingId;
        }

        if (magicToken?.trim()) {
          body.magicToken = magicToken.trim();
        }

        const res = await fetch(`/api/leads/${leadId}/log-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
          if (data.field === "reason") setReasonError(data.error ?? "Invalid reason");
          else if (data.field === "callbackAt") setScheduleError(data.error ?? "Invalid time");
          else if (data.field === "result") setFormError(data.error ?? "Please select the call result");
          else setFormError(data.error ?? "Failed to log call");
          return;
        }

        const payload = (await res.json()) as {
          lead?: LeadRow;
          legacyOutcome?: string;
          noAnswerCount?: number;
        };

        if (payload.noAnswerCount != null) setNoAnswerCount(payload.noAnswerCount);

        if (payload.lead) onLeadUpdated?.(payload.lead);
        onLogged?.();

        const legacy =
          (payload.legacyOutcome as CallOutcome | undefined) ??
          deriveLegacyOutcome(reachOutcome, result);

        if (onMagicSubmitSuccess && payload.lead) {
          onMagicSubmitSuccess({
            outcome: legacy,
            lead: payload.lead,
            followUpDate: callbackAtIso ? callbackAtIso.slice(0, 10) : null,
            dealValue: null,
            notes: notes.trim(),
          });
        } else if (onSubmitSuccess) {
          onSubmitSuccess();
        } else {
          setSavedToast(true);
          window.setTimeout(() => setSavedToast(false), 2000);
        }
      }}
    >
      {!isCompact ? (
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
          Log call
        </div>
      ) : null}

      <SegmentedControl
        label="Did you reach them?"
        options={REACH_OUTCOMES.map((v) => ({ value: v, label: REACH_OUTCOME_LABELS[v] }))}
        value={reachOutcome}
        onChange={setReachOutcome}
        columns={3}
      />

      {isRealEstate ? (
        <div className="ag-fade-in space-y-2">
          <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
            Which property?
          </span>
          <select
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-sm"
            value={addingProperty ? "__add__" : listingId}
            onChange={(e) => {
              if (e.target.value === "__add__") {
                setAddingProperty(true);
                setNewListingId("");
              } else {
                setAddingProperty(false);
                setListingId(e.target.value);
              }
            }}
          >
            <option value="">Select property…</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {[l.address, l.suburb].filter(Boolean).join(", ") || l.id.slice(0, 8)}
              </option>
            ))}
            <option value="__add__">Add another property…</option>
          </select>
          {addingProperty ? (
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-sm"
              value={newListingId}
              onChange={(e) => setNewListingId(e.target.value)}
            >
              <option value="">Choose listing to add…</option>
              {listings
                .filter((l) => !interestedListingIds.includes(l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {[l.address, l.suburb].filter(Boolean).join(", ") || l.id.slice(0, 8)}
                  </option>
                ))}
            </select>
          ) : null}
          {propertyError ? <p className="text-xs text-red-400">{propertyError}</p> : null}
        </div>
      ) : null}

      {reachOutcome === "reached" ? (
        <>
          <div className="ag-fade-in">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
              Result
            </span>
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--border)] divide-x divide-y divide-[var(--border)]">
              {CALL_RESULTS.map((v) => {
                const active = result === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setResult(active ? null : v)}
                    className={[
                      "min-h-[44px] px-3 py-2.5 text-sm transition-all touch-manipulation sm:min-h-0",
                      active
                        ? "bg-[var(--accent-muted)] font-medium text-[var(--text-primary)]"
                        : "bg-[var(--surface-card)] text-ink-secondary hover:bg-[var(--bg-tertiary)] hover:text-ink-primary",
                    ].join(" ")}
                  >
                    {CALL_RESULT_LABELS[v]}
                  </button>
                );
              })}
            </div>
          </div>

          {result === "follow_up" ? (
            <ReasonPills
              label="What's the hold-up?"
              options={stallReasons}
              value={reason}
              onChange={setReason}
            />
          ) : null}

          {result === "lost" ? (
            <ReasonPills
              label="Why did it die?"
              options={lostReasons}
              value={reason}
              onChange={setReason}
            />
          ) : null}

          {result === "not_qualified" ? (
            <ReasonPills
              label="Why not a fit?"
              options={notQualifiedReasons}
              value={reason}
              onChange={setReason}
              hint='Aggregated "not a fit" reasons indicate ad-targeting mismatch, not a sales problem.'
            />
          ) : null}

          {result === "won" ? (
            <p className="ag-fade-in text-xs text-ink-tertiary">
              Deal won — add any confirmation details in notes below.
            </p>
          ) : null}

          <div className="ag-fade-in space-y-2">
            <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
              Did they ask for anything?
            </span>
            <div className="flex flex-wrap gap-2">
              {assetOptions.map((opt) => {
                const active = assetsRequested.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleAsset(opt.key)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-[13px] transition-all touch-manipulation",
                      active
                        ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--status-won-fg)]"
                        : "border-[var(--border)] text-ink-secondary hover:border-[var(--border-hover)] hover:text-ink-primary",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {assetsRequested.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {canDirectSendOnly ? (
                  <button
                    type="button"
                    disabled={directSending}
                    onClick={() => void directSendPortfolioTestimonials()}
                    className="rounded-md border border-[var(--accent-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--status-won-fg)] touch-manipulation hover:bg-[var(--accent-muted)] disabled:opacity-50"
                  >
                    {directSending ? "Sending…" : "Send now"}
                  </button>
                ) : null}
                {wantsSimilarListings && clientId && resolvedContactId && effectiveListingId ? (
                  <button
                    type="button"
                    disabled={directSending}
                    onClick={() => void sendSimilarListings()}
                    className="rounded-md border border-[var(--accent-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--status-won-fg)] touch-manipulation hover:bg-[var(--accent-muted)] disabled:opacity-50"
                  >
                    {directSending ? "Sending…" : "Send similar listings"}
                  </button>
                ) : null}
                {onOpenSendTab && selectedSendTypes.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpenSendTab(selectedSendTypes)}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] text-ink-primary touch-manipulation hover:bg-surface-card-alt"
                  >
                    {canDirectSendOnly ? "Open send panel" : "Send now"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {showScheduleViewing ? (
            <div className="ag-fade-in space-y-2">
              <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
                Quick action
              </span>
              {viewingBookedLabel ? (
                <p className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-2 text-[13px] text-[var(--status-won-fg)]">
                  Viewing booked for {viewingBookedLabel}
                </p>
              ) : null}
              {!viewingOpen ? (
                <button
                  type="button"
                  onClick={() => setViewingOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-[13px] text-ink-secondary transition-all touch-manipulation hover:border-[var(--border-hover)] hover:text-ink-primary"
                >
                  <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Schedule a viewing
                </button>
              ) : clientId && resolvedContactId ? (
                <ScheduleViewingPanel
                  clientId={clientId}
                  contactId={resolvedContactId}
                  interestedListingIds={
                    effectiveListingId
                      ? Array.from(new Set([...interestedListingIds, effectiveListingId]))
                      : interestedListingIds
                  }
                  defaultListingId={effectiveListingId || null}
                  embedded
                  defaultOpen
                  onCancel={() => setViewingOpen(false)}
                  onScheduled={({ scheduledAt }) => {
                    const label = new Date(scheduledAt).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    });
                    setViewingBookedLabel(label);
                    setViewingOpen(false);
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {reachOutcome === "no_answer" ? (
        <p className="ag-fade-in rounded-lg border border-[var(--border)] bg-[var(--surface-card-alt)] px-3 py-2.5 text-[13px] text-ink-secondary">
          Attempt #{noAnswerCount + 1}. Repeated no-answers keep this lead in Call now, then
          Recover — and feed retargeting when it graduates.
        </p>
      ) : null}

      {needsSchedule ? (
        <div className="ag-fade-in space-y-3">
          <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
            When should it come back?
          </span>
          <div className="flex flex-wrap gap-2">
            {CALLBACK_SCHEDULE_OPTIONS.map((opt) => {
              const active = scheduleOption === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setScheduleOption(active ? "" : opt);
                    setScheduleError(null);
                  }}
                  className={[
                    "rounded-full border px-3 py-1.5 text-[13px] transition-all touch-manipulation",
                    active
                      ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--status-won-fg)]"
                      : "border-[var(--border)] text-ink-secondary hover:border-[var(--border-hover)] hover:text-ink-primary",
                  ].join(" ")}
                >
                  {CALLBACK_SCHEDULE_LABELS[opt]}
                </button>
              );
            })}
          </div>
          {scheduleOption === "pick" ? (
            <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
              Date & time
              <input
                type="datetime-local"
                className={`input-base mt-1 min-w-0 w-full ${fieldZoomClass}`}
                min={`${minPickDate}T00:00`}
                value={customCallback}
                onChange={(e) => {
                  setCustomCallback(e.target.value);
                  setScheduleError(null);
                }}
              />
            </label>
          ) : null}
          {reachOutcome === "reached" && result === "follow_up" ? (
            <button
              type="button"
              onClick={() => setConvertLater((v) => !v)}
              className={[
                "flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-all touch-manipulation",
                convertLater
                  ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--status-won-fg)]"
                  : "border-[var(--border)] text-ink-secondary hover:text-ink-primary",
              ].join(" ")}
            >
              <Star
                className={`h-4 w-4 ${convertLater ? "text-[var(--accent-fg)]" : ""}`}
                strokeWidth={1.5}
                fill={convertLater ? "currentColor" : "none"}
              />
              Save to my convert-later picks
            </button>
          ) : null}
          {scheduleError ? (
            <p className="font-sans text-[12px] text-[#DC2626]">{scheduleError}</p>
          ) : null}
        </div>
      ) : null}

      {reasonError ? <p className="font-sans text-[12px] text-[#DC2626]">{reasonError}</p> : null}

      <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
        Notes
        <textarea
          name="notes"
          className={`textarea-base mt-1 min-w-0 resize-none ${fieldZoomClass}`}
          rows={3}
        />
      </label>

      {formError ? <p className="font-sans text-[12px] text-[#DC2626]">{formError}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="submit"
          className={
            isMagic
              ? "min-h-[48px] w-full touch-manipulation rounded-md bg-[var(--accent)] py-3 text-base font-medium text-[var(--accent-foreground)] sm:min-h-0 sm:text-[13px]"
              : isCompact
                ? "min-h-12 w-full touch-manipulation rounded-xl bg-[var(--accent)] py-3 text-[15px] font-semibold text-[var(--accent-foreground)]"
                : "min-h-12 w-full touch-manipulation rounded-md bg-[var(--accent)] py-3 text-[13px] font-medium text-[var(--accent-foreground)] sm:min-h-0"
          }
        >
          {isCompact && channel === "whatsapp" ? "Log WhatsApp" : "Save call log"}
        </button>
        {!onMagicSubmitSuccess && !onSubmitSuccess && savedToast ? (
          <span className="flex items-center gap-1.5 text-sm text-[var(--success-fg)]">
            <Check className="h-4 w-4" strokeWidth={2} />
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
