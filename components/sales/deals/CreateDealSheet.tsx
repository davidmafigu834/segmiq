"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  CircleDollarSign,
  Handshake,
} from "lucide-react";
import type { DealRow, DecisionMakerStatus, LeadRow } from "@/types";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import {
  Avatar,
  Button,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
  Select,
  SegmentedControl,
  TextArea,
  useSalesToast,
} from "@/components/sales/ui";
import { getDealReadiness } from "@/lib/sales/deals/readiness";
import {
  BUYING_TIMEFRAME_OPTIONS,
  NEXT_ACTION_OPTIONS,
  buildCreateDealPayload,
  currencyPrefix,
  normalizeBuyingTimeframe,
  parseLeadBudgetHint,
  suggestDealName,
  toDatetimeLocalValue,
  type DealValueMode,
} from "@/lib/sales/deals/create-deal-form";
import {
  formatLeadIntent,
  formatLeadSource,
} from "@/lib/sales/leads-directory/format";
import { cn } from "@/lib/ui/cn";
import { format } from "date-fns";

type Props = {
  lead: LeadRow;
  open: boolean;
  onClose: () => void;
  onCreated: (deal: DealRow, meta?: { alreadyExisted: boolean }) => void;
  /** Practice Mode: never call production create API. */
  practiceMode?: boolean;
  onPracticeCreated?: () => void;
  currency?: string | null;
};

function locationFromLead(lead: LeadRow): string {
  const fd = lead.form_data;
  if (fd && typeof fd === "object") {
    for (const key of ["location", "suburb", "city", "area", "address"]) {
      const v = fd[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

export function CreateDealSheet({
  lead,
  open,
  onClose,
  onCreated,
  practiceMode = false,
  onPracticeCreated,
  currency = "USD",
}: Props) {
  const { toast } = useSalesToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const budgetHint = useMemo(() => parseLeadBudgetHint(lead.budget), [lead.budget]);

  const [name, setName] = useState(() => suggestDealName(lead));
  const [serviceSummary, setServiceSummary] = useState(lead.project_type?.trim() ?? "");
  const [customerNeed, setCustomerNeed] = useState(lead.customer_need?.trim() ?? "");
  const [location, setLocation] = useState(() => locationFromLead(lead));
  const [buyingTimeframe, setBuyingTimeframe] = useState(() =>
    normalizeBuyingTimeframe(lead.buying_timeframe ?? lead.timeline)
  );
  const [decisionMakerStatus, setDecisionMakerStatus] = useState<
    DecisionMakerStatus | ""
  >(lead.decision_maker_status ?? "");
  const [decisionMakerName, setDecisionMakerName] = useState("");
  const [valueMode, setValueMode] = useState<DealValueMode>(budgetHint.mode);
  const [exactValue, setExactValue] = useState(
    budgetHint.exact != null ? String(budgetHint.exact) : ""
  );
  const [rangeMin, setRangeMin] = useState(
    budgetHint.min != null ? String(budgetHint.min) : ""
  );
  const [rangeMax, setRangeMax] = useState(
    budgetHint.max != null ? String(budgetHint.max) : ""
  );
  const [expectedDecisionAt, setExpectedDecisionAt] = useState("");
  const [nextActionLabel, setNextActionLabel] = useState<string>("Follow up");
  const [nextActionOther, setNextActionOther] = useState(false);
  const [nextActionAt, setNextActionAt] = useState(() =>
    toDatetimeLocalValue(lead.follow_up_date)
  );
  const [allowWithoutNextAction, setAllowWithoutNextAction] = useState(false);
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingDealId, setExistingDealId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset / prefill when opening for a lead
  useEffect(() => {
    if (!open) return;
    const hint = parseLeadBudgetHint(lead.budget);
    setName(suggestDealName(lead));
    setServiceSummary(lead.project_type?.trim() ?? "");
    setCustomerNeed(lead.customer_need?.trim() ?? "");
    setLocation(locationFromLead(lead));
    setBuyingTimeframe(normalizeBuyingTimeframe(lead.buying_timeframe ?? lead.timeline));
    setDecisionMakerStatus(lead.decision_maker_status ?? "");
    setDecisionMakerName("");
    setValueMode(hint.mode);
    setExactValue(hint.exact != null ? String(hint.exact) : "");
    setRangeMin(hint.min != null ? String(hint.min) : "");
    setRangeMax(hint.max != null ? String(hint.max) : "");
    setExpectedDecisionAt("");
    setNextActionLabel("Follow up");
    setNextActionOther(false);
    setNextActionAt(toDatetimeLocalValue(lead.follow_up_date));
    setAllowWithoutNextAction(false);
    setNotes("");
    setMoreOpen(Boolean(locationFromLead(lead) || lead.decision_maker_status));
    setSaving(false);
    setError(null);
    setExistingDealId(null);
    setFieldErrors({});
    const t = window.setTimeout(() => {
      const el = nameRef.current;
      if (!el) return;
      if (suggestDealName(lead)) {
        // Prefill present — leave focus on name for quick edit, or skip to value if solid
        el.focus();
        el.select();
      } else {
        el.focus();
      }
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, lead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  const readiness = useMemo(
    () =>
      getDealReadiness({
        lead,
        discovery: {
          customerNeed: customerNeed || lead.customer_need,
          projectType: serviceSummary || lead.project_type || name,
          interestConfirmed: true,
          buyingTimeframe,
          nextStepAgreed:
            Boolean(nextActionAt || nextActionLabel) || allowWithoutNextAction,
          nextActionAt: nextActionAt || null,
          valuePending: valueMode === "later",
          estimatedValue:
            valueMode === "exact"
              ? Number(exactValue.replace(/[^0-9.]/g, "")) || null
              : valueMode === "range"
                ? Number(rangeMin.replace(/[^0-9.]/g, "")) || null
                : null,
        },
      }),
    [
      lead,
      customerNeed,
      serviceSummary,
      name,
      buyingTimeframe,
      nextActionAt,
      nextActionLabel,
      allowWithoutNextAction,
      valueMode,
      exactValue,
      rangeMin,
    ]
  );

  const sourceLabel = formatLeadSource(lead.source).label;
  const intentLabel = formatLeadIntent(lead.score);
  const prefix = currencyPrefix(currency);
  const hasNextAction = Boolean(nextActionLabel.trim() && nextActionAt);
  const showNextActionWarn = !hasNextAction && !allowWithoutNextAction;

  if (!open) return null;

  async function submit() {
    setError(null);
    setExistingDealId(null);
    setFieldErrors({});

    const built = buildCreateDealPayload({
      name,
      serviceSummary,
      customerNeed,
      location,
      buyingTimeframe,
      decisionMakerStatus,
      decisionMakerName,
      expectedDecisionAt,
      valueMode,
      exactValue,
      rangeMin,
      rangeMax,
      nextActionLabel: allowWithoutNextAction && !nextActionLabel.trim() ? "" : nextActionLabel,
      nextActionAt: allowWithoutNextAction && !nextActionAt ? "" : nextActionAt,
      notes,
    });

    if (!built.ok) {
      setFieldErrors(built.fieldErrors);
      return;
    }

    if (showNextActionWarn) {
      setFieldErrors({
        nextAction: "Deals are easier to manage when the next action is clear.",
      });
      return;
    }

    if (practiceMode) {
      setSaving(true);
      window.setTimeout(() => {
        setSaving(false);
        onPracticeCreated?.();
        toast({
          tone: "success",
          title: "Deal created",
          description: "Practice only — your real sales data was not changed.",
        });
        onClose();
      }, 450);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/create-deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        deal?: DealRow;
        alreadyExisted?: boolean;
      };

      if (res.ok && data.deal) {
        if (data.alreadyExisted) {
          setExistingDealId(data.deal.id);
          setError("A Deal has already been created from this Lead.");
          onCreated(data.deal, { alreadyExisted: true });
          return;
        }
        onCreated(data.deal, { alreadyExisted: false });
        onClose();
        return;
      }

      if (!res.ok || !data.deal) {
        setError(
          data.error ||
            "We couldn't create this Deal. Your Lead has not been changed."
        );
        return;
      }
    } catch {
      setError("We couldn't create this Deal. Your Lead has not been changed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumSheet
      size="lg"
      labelledBy="create-deal-title"
      descriptionId="create-deal-desc"
      title="Create Deal"
      description="Turn this qualified Lead into a commercial opportunity you can manage through your Pipeline."
      icon={<Handshake className="h-5 w-5" strokeWidth={1.8} aria-hidden />}
      badge={
        practiceMode ? (
          <span className="rounded-full border border-sales-border bg-sales-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-sales-text-secondary">
            Practice
          </span>
        ) : null
      }
      closeDisabled={saving}
      elevateForCourse={practiceMode}
      onClose={onClose}
      className="max-sm:max-h-[100dvh] max-sm:rounded-none sm:max-w-[680px]"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-[12px] text-sales-text-muted sm:block">
            You can update Deal details later.
          </p>
          <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="flex-1 sm:flex-none"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1 sm:min-w-[148px] sm:flex-none"
              loading={saving}
              disabled={saving}
              data-course-target="create-deal-submit"
              onClick={() => void submit()}
            >
              {saving ? "Creating Deal..." : "Create Deal"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5" data-course-target="create-deal-modal">
        {practiceMode ? (
          <p className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-[12px] text-sales-text-secondary">
            Practice — actions here don&apos;t affect your real sales data.
          </p>
        ) : null}

        {/* Lead summary */}
        <section className="flex items-start gap-3 rounded-[12px] border border-sales-border bg-sales-surface-subtle px-3.5 py-3">
          <Avatar name={lead.name?.trim() || "Lead"} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-sales-text-primary">
              {lead.name?.trim() || "Unnamed lead"}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
              {[sourceLabel, intentLabel].filter(Boolean).join(" · ")}
            </p>
            {(lead.project_type || lead.customer_need) && (
              <p className="mt-1 line-clamp-2 text-[12px] text-sales-text-muted">
                {lead.project_type?.trim() || lead.customer_need?.trim()}
              </p>
            )}
            <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-sales-text-muted">
              <div>
                <dt className="sr-only">Source</dt>
                <dd>Source · {sourceLabel}</dd>
              </div>
              {intentLabel ? (
                <div>
                  <dt className="sr-only">Intent</dt>
                  <dd>Intent · {intentLabel}</dd>
                </div>
              ) : null}
              <div>
                <dt className="sr-only">Captured</dt>
                <dd>Captured · {format(new Date(lead.created_at), "d MMM yyyy")}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Deal readiness */}
        <section
          data-course-target="deal-readiness"
          className="rounded-[12px] border border-sales-border px-3.5 py-3"
        >
          <h3 className="text-[13px] font-semibold text-sales-text-primary">Deal readiness</h3>
          <ul className="mt-2 space-y-1.5">
            {readiness.items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-[12px]">
                {item.done ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sales-success" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sales-text-muted" aria-hidden />
                )}
                <span className={item.done ? "text-sales-text-primary" : "text-sales-text-secondary"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          {readiness.ready ? (
            <p className="mt-3 text-[12px] font-medium text-sales-text-primary">
              Ready to create Deal
              <span className="mt-0.5 block font-normal text-sales-text-secondary">
                You have enough information to start managing this opportunity through your
                Pipeline.
              </span>
            </p>
          ) : (
            <p className="mt-3 text-[12px] text-sales-warning">
              A little more information will make this Deal easier to manage.
              <span className="mt-0.5 block text-sales-text-secondary">
                {readiness.missingRequired.map((m) => m.label).join(" · ")}
              </span>
            </p>
          )}
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-[12px] border border-sales-danger/30 bg-sales-danger-soft px-3.5 py-3"
          >
            <p className="text-[13px] font-medium text-sales-danger-fg">{error}</p>
            {existingDealId ? (
              <a
                href={`/sales/deals/${existingDealId}`}
                className="mt-2 inline-flex text-[13px] font-semibold text-sales-text-primary underline-offset-2 hover:underline"
              >
                Open Deal
              </a>
            ) : (
              <button
                type="button"
                className="mt-2 text-[13px] font-semibold text-sales-text-primary underline-offset-2 hover:underline"
                onClick={() => void submit()}
              >
                Try again
              </button>
            )}
          </div>
        ) : null}

        {/* Deal */}
        <section className="space-y-3 border-t border-sales-border-subtle pt-5">
          <div>
            <FieldLabel htmlFor="create-deal-name" required>
              Deal name
            </FieldLabel>
            <Input
              ref={nameRef}
              id="create-deal-name"
              data-course-target="create-deal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 5kW Solar Installation"
              invalid={Boolean(fieldErrors.name)}
              autoComplete="off"
            />
            <FieldError>{fieldErrors.name}</FieldError>
          </div>

          {(!serviceSummary.trim() || serviceSummary.trim() !== name.trim()) && (
            <div>
              <FieldLabel htmlFor="create-deal-service">Service / project</FieldLabel>
              <Input
                id="create-deal-service"
                value={serviceSummary}
                onChange={(e) => setServiceSummary(e.target.value)}
                placeholder="What are you trying to win?"
              />
            </div>
          )}
        </section>

        {/* Value */}
        <section className="space-y-3 border-t border-sales-border-subtle pt-5" data-course-target="create-deal-value">
          <div className="flex items-start gap-2">
            <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-sales-text-muted" aria-hidden />
            <div>
              <h3 className="text-[13px] font-semibold text-sales-text-primary">
                Estimated Deal value
              </h3>
              <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                Use what you know now. You can update this later as the Deal becomes clearer.
              </p>
            </div>
          </div>

          <SegmentedControl
            aria-label="Value type"
            className="w-full [&>button]:flex-1"
            value={valueMode}
            onChange={setValueMode}
            options={[
              { value: "exact", label: "Exact estimate" },
              { value: "range", label: "Range" },
              { value: "later", label: "Estimate later" },
            ]}
          />

          {valueMode === "exact" ? (
            <div>
              <FieldLabel htmlFor="create-deal-exact">Estimated value</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-sales-text-muted">
                  {prefix.trim()}
                </span>
                <Input
                  id="create-deal-exact"
                  inputMode="decimal"
                  className="pl-8"
                  value={exactValue}
                  onChange={(e) => setExactValue(e.target.value)}
                  placeholder="6,500"
                  invalid={Boolean(fieldErrors.exactValue)}
                />
              </div>
              <FieldError>{fieldErrors.exactValue}</FieldError>
            </div>
          ) : null}

          {valueMode === "range" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="create-deal-min">Minimum</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-sales-text-muted">
                    {prefix.trim()}
                  </span>
                  <Input
                    id="create-deal-min"
                    inputMode="decimal"
                    className="pl-8"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                    placeholder="5,000"
                    invalid={Boolean(fieldErrors.rangeMin)}
                  />
                </div>
                <FieldError>{fieldErrors.rangeMin}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="create-deal-max">Maximum</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-sales-text-muted">
                    {prefix.trim()}
                  </span>
                  <Input
                    id="create-deal-max"
                    inputMode="decimal"
                    className="pl-8"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(e.target.value)}
                    placeholder="7,000"
                    invalid={Boolean(fieldErrors.rangeMax)}
                  />
                </div>
                <FieldError>{fieldErrors.rangeMax}</FieldError>
              </div>
            </div>
          ) : null}

          {valueMode === "later" ? (
            <p className="rounded-[10px] bg-sales-surface-subtle px-3 py-2.5 text-[12px] text-sales-text-secondary">
              That&apos;s okay. You can estimate the Deal after a site assessment or further
              discovery. It will show as <span className="font-medium text-sales-text-primary">Value not estimated</span>
              — not {prefix}0.
            </p>
          ) : null}
        </section>

        {/* Timing */}
        <section className="space-y-3 border-t border-sales-border-subtle pt-5">
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-sales-text-muted" aria-hidden />
            <h3 className="text-[13px] font-semibold text-sales-text-primary">Timing</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="create-deal-timeframe">Buying timeframe</FieldLabel>
              <Select
                id="create-deal-timeframe"
                value={buyingTimeframe}
                onChange={(e) => setBuyingTimeframe(e.target.value)}
              >
                <option value="">Select…</option>
                {BUYING_TIMEFRAME_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                {buyingTimeframe &&
                !(BUYING_TIMEFRAME_OPTIONS as readonly string[]).includes(buyingTimeframe) ? (
                  <option value={buyingTimeframe}>{buyingTimeframe}</option>
                ) : null}
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="create-deal-decision">Expected decision</FieldLabel>
              <Input
                id="create-deal-decision"
                type="date"
                value={expectedDecisionAt}
                onChange={(e) => setExpectedDecisionAt(e.target.value)}
                invalid={Boolean(fieldErrors.expectedDecisionAt)}
              />
              <FieldError>{fieldErrors.expectedDecisionAt}</FieldError>
            </div>
          </div>
        </section>

        {/* Next step */}
        <section
          className="space-y-3 border-t border-sales-border-subtle pt-5"
          data-course-target="create-deal-next-action"
        >
          <div className="flex items-start gap-2">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-sales-text-muted" aria-hidden />
            <div>
              <h3 className="text-[13px] font-semibold text-sales-text-primary">
                What happens next?
              </h3>
              <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                Every active Deal should have a next action.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="create-deal-next-label">Next step</FieldLabel>
              <Select
                id="create-deal-next-label"
                value={
                  nextActionOther
                    ? "__other__"
                    : (NEXT_ACTION_OPTIONS as readonly string[]).includes(nextActionLabel)
                      ? nextActionLabel
                      : nextActionLabel
                        ? "__other__"
                        : ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__other__") {
                    setNextActionOther(true);
                    setNextActionLabel("");
                  } else {
                    setNextActionOther(false);
                    setNextActionLabel(v);
                  }
                }}
              >
                <option value="">Select…</option>
                {NEXT_ACTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value="__other__">Other</option>
              </Select>
              {nextActionOther ||
              (nextActionLabel !== "" &&
                !(NEXT_ACTION_OPTIONS as readonly string[]).includes(nextActionLabel)) ? (
                <Input
                  className="mt-2"
                  value={nextActionLabel}
                  onChange={(e) => {
                    setNextActionOther(true);
                    setNextActionLabel(e.target.value);
                  }}
                  placeholder="Describe the next step"
                />
              ) : null}
            </div>
            <div>
              <FieldLabel htmlFor="create-deal-next-when">When?</FieldLabel>
              <Input
                id="create-deal-next-when"
                type="datetime-local"
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
                invalid={Boolean(fieldErrors.nextActionAt)}
              />
              <FieldError>{fieldErrors.nextActionAt}</FieldError>
            </div>
          </div>

          {showNextActionWarn ? (
            <div className="rounded-[10px] border border-sales-warning/30 bg-sales-warning-soft px-3 py-2.5">
              <p className="text-[12px] text-sales-text-primary">
                Deals are easier to manage when the next action is clear.
              </p>
              <label className="mt-2 flex items-center gap-2 text-[12px] text-sales-text-secondary">
                <input
                  type="checkbox"
                  checked={allowWithoutNextAction}
                  onChange={(e) => setAllowWithoutNextAction(e.target.checked)}
                  className="h-4 w-4 rounded border-sales-border-strong"
                />
                Create Deal without next action
              </label>
              <FieldError>{fieldErrors.nextAction}</FieldError>
            </div>
          ) : null}
        </section>

        {/* Notes */}
        <section className="space-y-2 border-t border-sales-border-subtle pt-5">
          <FieldLabel htmlFor="create-deal-notes">Deal notes</FieldLabel>
          <TextArea
            id="create-deal-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add anything important from your conversation..."
            className="min-h-[72px]"
          />
        </section>

        {/* More details */}
        <section className="border-t border-sales-border-subtle pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between py-2 text-left text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
          >
            More Deal details
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {moreOpen ? (
            <div className="mt-2 space-y-3 pb-1">
              <div>
                <FieldLabel htmlFor="create-deal-location">Location</FieldLabel>
                <Input
                  id="create-deal-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Suburb / city"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="create-deal-dm">Decision maker</FieldLabel>
                  <Select
                    id="create-deal-dm"
                    value={decisionMakerStatus}
                    onChange={(e) =>
                      setDecisionMakerStatus(e.target.value as DecisionMakerStatus | "")
                    }
                  >
                    <option value="">Unknown</option>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                    <option value="UNKNOWN">Not sure</option>
                  </Select>
                </div>
                {decisionMakerStatus === "YES" ? (
                  <div>
                    <FieldLabel htmlFor="create-deal-dm-name">Decision maker name</FieldLabel>
                    <Input
                      id="create-deal-dm-name"
                      value={decisionMakerName}
                      onChange={(e) => setDecisionMakerName(e.target.value)}
                      placeholder="Who decides?"
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <FieldLabel htmlFor="create-deal-need">Customer requirement</FieldLabel>
                <TextArea
                  id="create-deal-need"
                  rows={2}
                  value={customerNeed}
                  onChange={(e) => setCustomerNeed(e.target.value)}
                  placeholder="What does the customer need?"
                  className="min-h-[64px]"
                />
                <FieldHint>Updates discovery on the Lead when the Deal is created.</FieldHint>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </PremiumSheet>
  );
}
