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

function Row({
  label,
  value,
  sales,
}: {
  label: string;
  value: string | null;
  sales?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span
        className={
          sales
            ? "text-[11px] uppercase tracking-wide text-sales-text-muted"
            : "text-xs uppercase tracking-wide text-[var(--text-tertiary)]"
        }
      >
        {label}
      </span>
      <span className={sales ? "text-[13px] text-sales-text-primary" : "text-sm text-[var(--text-primary)]"}>
        {value}
      </span>
    </div>
  );
}

/** Renders the agency's "How to pay" details from billing_settings. */
export function HowToPay({
  settings,
  variant = "legacy",
}: {
  settings: PaymentSettings;
  variant?: "legacy" | "sales";
}) {
  const sales = variant === "sales";
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
          <p
            className={
              sales
                ? "mb-2 flex items-center gap-2 text-[13px] font-medium text-sales-text-primary"
                : "mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"
            }
          >
            <Landmark className={sales ? "h-4 w-4 text-sales-text-secondary" : "h-4 w-4 text-[var(--accent)]"} /> Bank
            transfer
          </p>
          <div
            className={
              sales
                ? "divide-y divide-sales-border-subtle rounded-[10px] border border-sales-border px-4"
                : "divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-4"
            }
          >
            <Row sales={sales} label="Bank" value={settings.bank_name} />
            <Row sales={sales} label="Account name" value={settings.bank_account_name} />
            <Row sales={sales} label="Account number" value={settings.bank_account_number} />
            <Row sales={sales} label="Branch" value={settings.bank_branch} />
            <Row sales={sales} label="SWIFT" value={settings.swift} />
          </div>
        </div>
      ) : null}

      {hasMomo ? (
        <div>
          <p
            className={
              sales
                ? "mb-2 flex items-center gap-2 text-[13px] font-medium text-sales-text-primary"
                : "mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"
            }
          >
            <Smartphone className={sales ? "h-4 w-4 text-sales-text-secondary" : "h-4 w-4 text-[var(--accent)]"} />{" "}
            Mobile money
          </p>
          <div
            className={
              sales
                ? "divide-y divide-sales-border-subtle rounded-[10px] border border-sales-border px-4"
                : "divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-4"
            }
          >
            <Row sales={sales} label="Number" value={settings.mobile_money_number} />
            <Row sales={sales} label="Name" value={settings.mobile_money_name} />
          </div>
        </div>
      ) : null}

      {settings.payment_instructions ? (
        <div
          className={
            sales
              ? "flex gap-2 rounded-[10px] border border-sales-border bg-sales-surface-subtle p-4"
              : "flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]/40 p-4"
          }
        >
          <Info
            className={
              sales
                ? "mt-0.5 h-4 w-4 shrink-0 text-sales-text-muted"
                : "mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
            }
          />
          <p
            className={
              sales
                ? "text-[13px] leading-relaxed text-sales-text-secondary"
                : "text-sm leading-relaxed text-[var(--text-secondary)]"
            }
          >
            {settings.payment_instructions}
          </p>
        </div>
      ) : null}

      {!hasAny ? (
        <p className={sales ? "text-[13px] text-sales-text-muted" : "text-sm text-[var(--text-tertiary)]"}>
          Payment details haven&apos;t been published yet. Please contact your account manager.
        </p>
      ) : null}
    </div>
  );
}
