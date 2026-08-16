"use client";

import { useState } from "react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, FieldHint, FieldLabel, Input } from "@/components/sales/ui";

export function BillingInformationModal({
  clientId,
  companyName,
  billingEmail,
  onClose,
  onSaved,
}: {
  clientId: string;
  companyName: string;
  billingEmail: string | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(companyName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = name.trim();
    if (!next) {
      setError("Company name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/company-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save billing information.");
        return;
      }
      onSaved(next);
      onClose();
    } catch {
      setError("Could not save billing information.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumSheet
      title="Billing information"
      description="Company name appears on invoices. Billing email is the company owner email on file."
      onClose={onClose}
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="md" loading={busy} onClick={() => void save()}>
            Save changes
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="billing-company-name">Company</FieldLabel>
          <Input
            id="billing-company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="organization"
          />
        </div>
        <div>
          <FieldLabel htmlFor="billing-email">Billing contact</FieldLabel>
          <Input id="billing-email" value={billingEmail ?? ""} readOnly />
          <FieldHint>Invoices are sent to the company owner email on file.</FieldHint>
        </div>
        {error ? <p className="text-[12px] text-sales-danger">{error}</p> : null}
      </div>
    </PremiumSheet>
  );
}
