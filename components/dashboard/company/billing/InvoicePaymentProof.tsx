"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/sales/ui";
import { PAYMENT_METHODS } from "@/lib/billing/format";
import type { CompanyBillingInvoice } from "@/lib/billing/company-billing-types";

export function InvoicePaymentProof({ invoice }: { invoice: CompanyBillingInvoice }) {
  const router = useRouter();
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (invoice.status === "paid" || invoice.status === "void") return null;

  async function submit() {
    if (!file) {
      setError("Attach a proof of payment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("invoiceId", invoice.id);
      form.set("amount", String(invoice.amount));
      form.set("method", method);
      form.set("reference", reference);
      form.set("proof", file);
      const res = await fetch("/api/billing/client/proof", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "We couldn't submit the payment proof. Try again.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("We couldn't submit the payment proof. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (invoice.hasPendingPayment || done) {
    return (
      <p className="text-[13px] text-sales-text-secondary">
        A payment proof is awaiting confirmation.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-sales-text-secondary">
        Transfer the invoice amount using the published payment details, then upload proof.
      </p>
      <Field label="Payment method" htmlFor={`proof-method-${invoice.id}`}>
        <Select
          id={`proof-method-${invoice.id}`}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reference (optional)" htmlFor={`proof-ref-${invoice.id}`} optional>
        <Input
          id={`proof-ref-${invoice.id}`}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </Field>
      <Field label="Proof file" htmlFor={`proof-file-${invoice.id}`} error={error ?? undefined}>
        <Input
          id={`proof-file-${invoice.id}`}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void submit()}>
        Submit payment proof
      </Button>
    </div>
  );
}
