"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { DealRow, LeadRow } from "@/types";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, Field, Input, Select, TextArea, useSalesToast } from "@/components/sales/ui";
import { locationFromFormData } from "@/lib/sales/leads-directory/format";

export function ConvertWonCustomerSheet({
  lead,
  open,
  onClose,
  onSuccess,
}: {
  lead: LeadRow;
  open: boolean;
  onClose: () => void;
  onSuccess: (payload: { deal: DealRow; lead: LeadRow; contactId: string | null }) => void;
}) {
  const { toast } = useSalesToast();
  const [wonValue, setWonValue] = useState(
    lead.deal_value != null && lead.deal_value > 0 ? String(lead.deal_value) : ""
  );
  const [customerType, setCustomerType] = useState<"" | "company" | "individual">("");
  const [location, setLocation] = useState(lead.location ?? "");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit() {
    setError("");
    const value = parseFloat(wonValue.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter the final deal value.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert-won-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wonValue: value,
          customerType: customerType || undefined,
          location: location.trim() || undefined,
          primaryContactName: primaryContactName.trim() || undefined,
          industry: industry.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        deal?: DealRow;
        lead?: LeadRow;
        contactId?: string | null;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not record won customer.");
        return;
      }
      if (json.deal && json.lead) {
        toast({ tone: "success", title: "Won customer recorded" });
        onSuccess({ deal: json.deal, lead: json.lead, contactId: json.contactId ?? null });
        onClose();
      }
    } catch {
      setError("Network error — try again when you're back online.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PremiumSheet
      size="md"
      title="Record won customer"
      description="Closed on-site? Save the win, create the deal, and file them as a customer when you're back online."
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={() => void handleSubmit()}>
            Save won customer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2.5 rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-sales-success" aria-hidden />
          <p className="text-[12px] leading-relaxed text-sales-text-secondary">
            This creates a won deal, updates the contact to <strong className="text-sales-text-primary">Customer</strong>
            , and adds a call note for your manager. Works even if the lead was marked not qualified by mistake.
          </p>
        </div>

        <Field label="Final deal value" required>
          <Input
            value={wonValue}
            onChange={(e) => setWonValue(e.target.value)}
            placeholder="e.g. 4500"
            inputMode="decimal"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer type">
            <Select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as typeof customerType)}
            >
              <option value="">Select…</option>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </Select>
          </Field>
          <Field label="Location">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Harare"
            />
          </Field>
        </div>

        {customerType === "company" ? (
          <Field label="Primary contact">
            <Input
              value={primaryContactName}
              onChange={(e) => setPrimaryContactName(e.target.value)}
              placeholder={lead.name ?? "Contact name"}
            />
          </Field>
        ) : null}

        <Field label="Industry / category">
          <Input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="optional — e.g. Residential Solar"
          />
        </Field>

        <Field label="Notes">
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was sold, install notes, or payment details…"
            rows={3}
          />
        </Field>

        {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
      </div>
    </PremiumSheet>
  );
}
