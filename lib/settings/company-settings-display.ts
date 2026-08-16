import { ASSIGNMENT_MODE_LABELS, COMPANY_TIMEZONES } from "./company-settings-config";
import type { CompanyAccountSummary, CompanySettingsProfile, CompanySettingsQuote } from "./company-settings-types";
import { formatDate } from "@/lib/billing/format";
import { subscriptionStatusLabel } from "@/lib/billing/status";

export function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function companyPublicId(profile: CompanySettingsProfile): string {
  return profile.slug?.trim() || "—";
}

export function companyEmailDisplay(profile: CompanySettingsProfile, quote: CompanySettingsQuote): string {
  return displayOrDash(quote.company_email || profile.ownerEmail);
}

export function companyPhoneDisplay(quote: CompanySettingsQuote): string {
  return displayOrDash(quote.company_phone);
}

export function companyWebsiteDisplay(profile: CompanySettingsProfile, quote: CompanySettingsQuote): string {
  return displayOrDash(quote.company_website || profile.website);
}

export function businessTypeLabel(value: string | null | undefined): string {
  if (value === "real_estate") return "Real estate";
  if (value === "trades") return "Trades";
  return displayOrDash(value);
}

export function timezoneLabel(value: string | null | undefined): string {
  const match = COMPANY_TIMEZONES.find((tz) => tz.value === value);
  if (match) return match.label;
  return displayOrDash(value);
}

export function assignmentModeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ASSIGNMENT_MODE_LABELS[value] ?? value.replace(/_/g, " ");
}

export function teamSeatsLabel(account: CompanyAccountSummary): string {
  if (account.teamLimit == null) return `${account.teamUsed} / Unlimited`;
  return `${account.teamUsed} / ${account.teamLimit}`;
}

export function nextBillingLabel(account: CompanyAccountSummary): { label: string; value: string } {
  if (account.status === "cancelled") {
    return {
      label: "Access until",
      value: account.nextBillingDate ? formatDate(account.nextBillingDate) : "Not applicable",
    };
  }
  return {
    label: "Next Billing Date",
    value: account.nextBillingDate ? formatDate(account.nextBillingDate) : "Not applicable",
  };
}

export function planStatusLabel(status: string): string {
  return subscriptionStatusLabel(status);
}

export function companyInformationRows(
  profile: CompanySettingsProfile,
  quote: CompanySettingsQuote
): Array<{ label: string; value: string }> {
  return [
    { label: "Company Name", value: displayOrDash(profile.name) },
    { label: "Company Email", value: companyEmailDisplay(profile, quote) },
    { label: "Phone Number", value: companyPhoneDisplay(quote) },
    { label: "Website", value: companyWebsiteDisplay(profile, quote) },
    { label: "Industry", value: displayOrDash(profile.industry) },
    { label: "Company ID", value: companyPublicId(profile) },
  ];
}

export function confirmDiscardUnsaved(): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm("You have unsaved changes. Discard them?");
}
