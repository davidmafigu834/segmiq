"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardBody, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type BillingSettingsValues = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  swift: string;
  mobile_money_number: string;
  mobile_money_name: string;
  payment_instructions: string;
};

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
    </label>
  );
}

export function BillingSettingsClient({ initial }: { initial: BillingSettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState<BillingSettingsValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof BillingSettingsValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/billing/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save settings");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-md border border-[var(--error-border)] bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-muted)] px-4 py-3 text-sm text-[var(--success)]">
          Saved. These details now appear on newly issued invoice PDFs.
        </div>
      ) : null}

      <Card>
        <CardBody className="space-y-5">
          <div>
            <CardTitle>Bank transfer</CardTitle>
            <CardDescription>Shown in the &quot;How to pay&quot; block on every invoice.</CardDescription>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LabeledInput label="Bank name" value={values.bank_name} onChange={(v) => set("bank_name", v)} />
            <LabeledInput
              label="Account name"
              value={values.bank_account_name}
              onChange={(v) => set("bank_account_name", v)}
            />
            <LabeledInput
              label="Account number"
              value={values.bank_account_number}
              onChange={(v) => set("bank_account_number", v)}
            />
            <LabeledInput label="Branch" value={values.bank_branch} onChange={(v) => set("bank_branch", v)} />
            <LabeledInput label="SWIFT" value={values.swift} onChange={(v) => set("swift", v)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <CardTitle>Mobile money</CardTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LabeledInput
              label="Mobile money number"
              value={values.mobile_money_number}
              onChange={(v) => set("mobile_money_number", v)}
            />
            <LabeledInput
              label="Mobile money name"
              value={values.mobile_money_name}
              onChange={(v) => set("mobile_money_name", v)}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <div>
            <CardTitle>Payment instructions</CardTitle>
            <CardDescription>Free-text fallback shown beneath the payment details.</CardDescription>
          </div>
          <textarea
            value={values.payment_instructions}
            onChange={(e) => set("payment_instructions", e.target.value)}
            rows={4}
            placeholder="e.g. Send proof of payment to billing@youragency.com"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
          />
        </CardBody>
      </Card>

      <Button onClick={save} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save billing settings
      </Button>
    </div>
  );
}
