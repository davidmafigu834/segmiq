"use client";

import { useEffect, useRef, useState } from "react";
import { CircleDollarSign, PencilLine } from "lucide-react";
import type { DealRow, DecisionMakerStatus } from "@/types";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import {
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
import {
  BUYING_TIMEFRAME_OPTIONS,
  NEXT_ACTION_OPTIONS,
  buildDealUpdatePatch,
  currencyPrefix,
  normalizeBuyingTimeframe,
  toDatetimeLocalValue,
  valueModeFromDeal,
  type DealValueMode,
} from "@/lib/sales/deals/create-deal-form";

export type DealDetailsFocus =
  | "name"
  | "value"
  | "timeframe"
  | "expected_decision"
  | "next_action"
  | "decision_maker"
  | "location"
  | "service"
  | null;

type Props = {
  deal: DealRow;
  open: boolean;
  onClose: () => void;
  onSaved: (deal: DealRow) => void;
  focus?: DealDetailsFocus;
  currency?: string | null;
};

function expectedDateValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function DealDetailsEditorSheet({
  deal,
  open,
  onClose,
  onSaved,
  focus = null,
  currency = "USD",
}: Props) {
  const { toast } = useSalesToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const decisionRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(deal.name);
  const [serviceSummary, setServiceSummary] = useState(deal.service_summary ?? "");
  const [location, setLocation] = useState(deal.location ?? "");
  const [buyingTimeframe, setBuyingTimeframe] = useState(
    normalizeBuyingTimeframe(deal.buying_timeframe)
  );
  const [decisionMakerStatus, setDecisionMakerStatus] = useState<
    DecisionMakerStatus | ""
  >(deal.decision_maker_status ?? "");
  const [decisionMakerName, setDecisionMakerName] = useState(
    deal.decision_maker_name ?? ""
  );
  const [valueMode, setValueMode] = useState<DealValueMode>(() => valueModeFromDeal(deal));
  const [exactValue, setExactValue] = useState(() => {
    const n = deal.sales_estimate ?? deal.estimated_value;
    return n != null && n > 0 ? String(n) : "";
  });
  const [rangeMin, setRangeMin] = useState(
    deal.estimated_value_min != null ? String(deal.estimated_value_min) : ""
  );
  const [rangeMax, setRangeMax] = useState(
    deal.estimated_value_max != null ? String(deal.estimated_value_max) : ""
  );
  const [expectedDecisionAt, setExpectedDecisionAt] = useState(
    expectedDateValue(deal.expected_decision_at)
  );
  const [nextActionLabel, setNextActionLabel] = useState(
    deal.next_action_label ?? "Follow up"
  );
  const [nextActionOther, setNextActionOther] = useState(false);
  const [nextActionAt, setNextActionAt] = useState(() =>
    toDatetimeLocalValue(deal.next_action_at)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const mode = valueModeFromDeal(deal);
    setName(deal.name);
    setServiceSummary(deal.service_summary ?? "");
    setLocation(deal.location ?? "");
    setBuyingTimeframe(normalizeBuyingTimeframe(deal.buying_timeframe));
    setDecisionMakerStatus(deal.decision_maker_status ?? "");
    setDecisionMakerName(deal.decision_maker_name ?? "");
    setValueMode(mode);
    const exact = deal.sales_estimate ?? deal.estimated_value;
    setExactValue(exact != null && exact > 0 ? String(exact) : "");
    setRangeMin(deal.estimated_value_min != null ? String(deal.estimated_value_min) : "");
    setRangeMax(deal.estimated_value_max != null ? String(deal.estimated_value_max) : "");
    setExpectedDecisionAt(expectedDateValue(deal.expected_decision_at));
    const label = deal.next_action_label ?? "Follow up";
    const isPreset = (NEXT_ACTION_OPTIONS as readonly string[]).includes(label);
    setNextActionLabel(label);
    setNextActionOther(!isPreset && Boolean(label));
    setNextActionAt(toDatetimeLocalValue(deal.next_action_at));
    setSaving(false);
    setError(null);
    setFieldErrors({});

    const t = window.setTimeout(() => {
      if (focus === "value") valueRef.current?.scrollIntoView({ block: "center" });
      else if (focus === "next_action") nextRef.current?.scrollIntoView({ block: "center" });
      else if (focus === "expected_decision") decisionRef.current?.focus();
      else nameRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open, deal, focus]);

  if (!open) return null;

  const prefix = currencyPrefix(currency);

  async function submit() {
    setError(null);
    setFieldErrors({});
    const built = buildDealUpdatePatch({
      name,
      serviceSummary,
      location,
      buyingTimeframe,
      decisionMakerStatus,
      decisionMakerName,
      expectedDecisionAt,
      valueMode,
      exactValue,
      rangeMin,
      rangeMax,
      nextActionLabel: nextActionOther ? nextActionLabel : nextActionLabel,
      nextActionAt,
    });
    if (!built.ok) {
      setFieldErrors(built.fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.patch),
      });
      const data = (await res.json().catch(() => ({}))) as {
        deal?: DealRow;
        error?: string;
      };
      if (!res.ok || !data.deal) {
        setError(data.error || "We couldn't save Deal details. Nothing was changed.");
        return;
      }
      toast({
        tone: "success",
        title: "Deal updated",
        description: "Commercial details saved.",
      });
      onSaved(data.deal);
      onClose();
    } catch {
      setError("We couldn't save Deal details. Nothing was changed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumSheet
      size="lg"
      labelledBy="deal-details-editor-title"
      title="Complete Deal details"
      description="Fill in what you know so this Deal is easier to manage through your Pipeline."
      icon={<PencilLine className="h-5 w-5" strokeWidth={1.8} aria-hidden />}
      closeDisabled={saving}
      onClose={onClose}
      className="max-sm:max-h-[100dvh] max-sm:rounded-none sm:max-w-[680px]"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-[12px] text-sales-text-muted sm:block">
            You can update these again anytime.
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
              data-course-target="deal-details-save"
              onClick={() => void submit()}
            >
              {saving ? "Saving…" : "Save details"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5" data-course-target="deal-details-editor">
        {error ? (
          <div
            role="alert"
            className="rounded-[12px] border border-sales-danger/30 bg-sales-danger-soft px-3.5 py-3 text-[13px] font-medium text-sales-danger-fg"
          >
            {error}
          </div>
        ) : null}

        <section className="space-y-3">
          <div>
            <FieldLabel htmlFor="deal-edit-name" required>
              Deal name
            </FieldLabel>
            <Input
              ref={nameRef}
              id="deal-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 5kW Solar Installation"
              invalid={Boolean(fieldErrors.name)}
            />
            <FieldError>{fieldErrors.name}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="deal-edit-service">Service / project</FieldLabel>
            <TextArea
              id="deal-edit-service"
              rows={2}
              value={serviceSummary}
              onChange={(e) => setServiceSummary(e.target.value)}
              placeholder="What are you trying to win?"
              className="min-h-[64px]"
            />
          </div>
        </section>

        <section
          ref={valueRef}
          className="space-y-3 border-t border-sales-border-subtle pt-5"
          data-course-target="deal-details-value"
        >
          <div className="flex items-start gap-2">
            <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-sales-text-muted" aria-hidden />
            <div>
              <h3 className="text-[13px] font-semibold text-sales-text-primary">
                Estimated Deal value
              </h3>
              <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                Use what you know now. Estimate later is fine.
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
              <FieldLabel htmlFor="deal-edit-exact">Estimated value</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-sales-text-muted">
                  {prefix.trim()}
                </span>
                <Input
                  id="deal-edit-exact"
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
                <FieldLabel htmlFor="deal-edit-min">Minimum</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-sales-text-muted">
                    {prefix.trim()}
                  </span>
                  <Input
                    id="deal-edit-min"
                    inputMode="decimal"
                    className="pl-8"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                    invalid={Boolean(fieldErrors.rangeMin)}
                  />
                </div>
                <FieldError>{fieldErrors.rangeMin}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="deal-edit-max">Maximum</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-sales-text-muted">
                    {prefix.trim()}
                  </span>
                  <Input
                    id="deal-edit-max"
                    inputMode="decimal"
                    className="pl-8"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(e.target.value)}
                    invalid={Boolean(fieldErrors.rangeMax)}
                  />
                </div>
                <FieldError>{fieldErrors.rangeMax}</FieldError>
              </div>
            </div>
          ) : null}
          {valueMode === "later" ? (
            <p className="rounded-[10px] bg-sales-surface-subtle px-3 py-2.5 text-[12px] text-sales-text-secondary">
              Deal will show as <span className="font-medium text-sales-text-primary">Value not estimated</span>
              — not {prefix}0.
            </p>
          ) : null}
        </section>

        <section className="space-y-3 border-t border-sales-border-subtle pt-5">
          <h3 className="text-[13px] font-semibold text-sales-text-primary">Timing</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="deal-edit-timeframe">Buying timeframe</FieldLabel>
              <Select
                id="deal-edit-timeframe"
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
              <FieldLabel htmlFor="deal-edit-decision">Expected decision</FieldLabel>
              <Input
                ref={decisionRef}
                id="deal-edit-decision"
                type="date"
                value={expectedDecisionAt}
                onChange={(e) => setExpectedDecisionAt(e.target.value)}
                invalid={Boolean(fieldErrors.expectedDecisionAt)}
              />
              <FieldError>{fieldErrors.expectedDecisionAt}</FieldError>
            </div>
          </div>
        </section>

        <section
          ref={nextRef}
          className="space-y-3 border-t border-sales-border-subtle pt-5"
          data-course-target="deal-details-next-action"
        >
          <h3 className="text-[13px] font-semibold text-sales-text-primary">
            What happens next?
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="deal-edit-next-label">Next step</FieldLabel>
              <Select
                id="deal-edit-next-label"
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
              <FieldLabel htmlFor="deal-edit-next-when">When?</FieldLabel>
              <Input
                id="deal-edit-next-when"
                type="datetime-local"
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
                invalid={Boolean(fieldErrors.nextActionAt)}
              />
              <FieldError>{fieldErrors.nextActionAt}</FieldError>
              <FieldHint>Clear the date to remove the next action.</FieldHint>
            </div>
          </div>
        </section>

        <section className="space-y-3 border-t border-sales-border-subtle pt-5">
          <h3 className="text-[13px] font-semibold text-sales-text-primary">
            Additional details
          </h3>
          <div>
            <FieldLabel htmlFor="deal-edit-location">Location</FieldLabel>
            <Input
              id="deal-edit-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Suburb / city"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="deal-edit-dm">Decision maker</FieldLabel>
              <Select
                id="deal-edit-dm"
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
                <FieldLabel htmlFor="deal-edit-dm-name">Decision maker name</FieldLabel>
                <Input
                  id="deal-edit-dm-name"
                  value={decisionMakerName}
                  onChange={(e) => setDecisionMakerName(e.target.value)}
                  placeholder="Who decides?"
                />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </PremiumSheet>
  );
}
