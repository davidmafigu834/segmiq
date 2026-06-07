import { Landmark, Smartphone, Info } from "lucide-react";

export type PaymentSettings = {
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  swift: string | null;
  mobile_money_number: string | null;
  mobile_money_name: string | null;
  payment_instructions: string | null;
};

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span>
      <span className="text-sm text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

/** Renders the agency's "How to pay" details from billing_settings. */
export function HowToPay({ settings }: { settings: PaymentSettings }) {
  const hasBank = Boolean(
    settings.bank_name ||
      settings.bank_account_name ||
      settings.bank_account_number ||
      settings.bank_branch ||
      settings.swift
  );
  const hasMomo = Boolean(settings.mobile_money_number || settings.mobile_money_name);
  const hasAny = hasBank || hasMomo || Boolean(settings.payment_instructions);

  return (
    <div className="space-y-5">
      {hasBank ? (
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <Landmark className="h-4 w-4 text-[var(--accent)]" /> Bank transfer
          </p>
          <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-4">
            <Row label="Bank" value={settings.bank_name} />
            <Row label="Account name" value={settings.bank_account_name} />
            <Row label="Account number" value={settings.bank_account_number} />
            <Row label="Branch" value={settings.bank_branch} />
            <Row label="SWIFT" value={settings.swift} />
          </div>
        </div>
      ) : null}

      {hasMomo ? (
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <Smartphone className="h-4 w-4 text-[var(--accent)]" /> Mobile money
          </p>
          <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-4">
            <Row label="Number" value={settings.mobile_money_number} />
            <Row label="Name" value={settings.mobile_money_name} />
          </div>
        </div>
      ) : null}

      {settings.payment_instructions ? (
        <div className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]/40 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {settings.payment_instructions}
          </p>
        </div>
      ) : null}

      {!hasAny ? (
        <p className="text-sm text-[var(--text-tertiary)]">
          Payment details haven&apos;t been published yet. Please contact your account manager.
        </p>
      ) : null}
    </div>
  );
}
