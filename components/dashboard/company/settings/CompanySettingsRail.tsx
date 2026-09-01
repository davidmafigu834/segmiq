"use client";

import { Crown, Download, Headphones, Landmark } from "lucide-react";
import { Badge, Button, ErrorState } from "@/components/sales/ui";
import { SettingsActionRow } from "./SettingsActionRow";
import { nextBillingLabel, planStatusLabel, teamSeatsLabel } from "@/lib/settings/company-settings-display";
import { subscriptionStatusTone } from "@/lib/billing/status";
import type { CompanyAccountSummary } from "@/lib/settings/company-settings-types";
import type { BadgeTone } from "@/components/sales/ui";

function statusTone(status: string): BadgeTone {
  const tone = subscriptionStatusTone(status);
  if (tone === "success" || tone === "warning" || tone === "danger" || tone === "info") return tone;
  return "neutral";
}

export function CompanyAccountSummaryCard({
  account,
  error,
  onRetry,
}: {
  account: CompanyAccountSummary | null;
  error?: boolean;
  onRetry?: () => void;
}) {
  const next = account ? nextBillingLabel(account) : null;
  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface px-5 py-4">
      <h2 className="text-[15px] font-semibold text-sales-text-primary">Account Summary</h2>
      {error ? (
        <ErrorState
          title="Unable to load account summary"
          description="We couldn't retrieve your account details right now."
          onRetry={onRetry}
          size="compact"
        />
      ) : !account ? (
        <p className="mt-3 text-[13px] text-sales-text-secondary">No active subscription on this company.</p>
      ) : (
        <dl className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[12px] text-sales-text-secondary">Plan</dt>
            <dd className="flex items-center gap-2 text-[13px] font-medium text-sales-text-primary">
              {account.planLabel} Plan
              <Badge tone={statusTone(account.status)} appearance="soft">
                {planStatusLabel(account.status)}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[12px] text-sales-text-secondary">Billing Cycle</dt>
            <dd className="text-[13px] text-sales-text-primary">{account.billingCycle}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[12px] text-sales-text-secondary">{next?.label}</dt>
            <dd className="text-[13px] text-sales-text-primary">{next?.value}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[12px] text-sales-text-secondary">Team Members</dt>
            <dd className="text-[13px] text-sales-text-primary">{teamSeatsLabel(account)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export function CompanyQuickActionsCard() {
  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface px-5 py-4">
      <h2 className="text-[15px] font-semibold text-sales-text-primary">Quick Actions</h2>
      <div className="mt-2">
        <SettingsActionRow
          icon={<Crown size={14} strokeWidth={1.8} />}
          label="Manage Subscription"
          href="/client/billing"
        />
        <SettingsActionRow
          icon={<Download size={14} strokeWidth={1.8} />}
          label="Download Invoices"
          href="/client/billing"
        />
        <SettingsActionRow
          icon={<Landmark size={14} strokeWidth={1.8} />}
          label="Manage Payment Method"
          href="/client/billing"
        />
      </div>
    </section>
  );
}

export function SettingsNeedHelpCard({
  email,
  copy = "If you need assistance with your account, our support team is ready to help.",
}: {
  email?: string | null;
  copy?: string;
}) {
  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface px-5 py-4">
      <h2 className="text-[15px] font-semibold text-sales-text-primary">Need Help?</h2>
      <p className="mt-1.5 text-[13px] leading-snug text-sales-text-secondary">{copy}</p>
      {email ? (
        <Button
          variant="secondary"
          size="md"
          className="mt-3 w-full"
          leftIcon={<Headphones size={15} />}
          onClick={() => {
            window.location.href = `mailto:${email}?subject=${encodeURIComponent("SegmiQ account help")}`;
          }}
        >
          Contact Support
        </Button>
      ) : null}
    </section>
  );
}

export function CompanyContextRail({
  account,
  accountError,
  helpEmail,
  onRetryAccount,
}: {
  account: CompanyAccountSummary | null;
  accountError?: boolean;
  helpEmail?: string | null;
  onRetryAccount?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CompanyAccountSummaryCard account={account} error={accountError} onRetry={onRetryAccount} />
      <CompanyQuickActionsCard />
      <SettingsNeedHelpCard email={helpEmail} />
    </div>
  );
}
