"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button, ConfirmDialog, Field, Input, Radio, Select, TextArea } from "@/components/sales/ui";
import { SettingsSectionCard, SettingsInfoGrid } from "./SettingsSectionCard";
import { CompanyAccountSummaryCard } from "./CompanySettingsRail";
import { companyNameInitials } from "@/lib/sales/navigation/company-nav-config";
import { uploadClientLogoFile } from "@/lib/storage/logo-upload";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { CRM_PLAN_FEATURES, isCrmPlan } from "@/lib/billing/plans";
import {
  COMPANY_TIMEZONES,
  DIAL_CODES,
} from "@/lib/settings/company-settings-config";
import {
  assignmentModeLabel,
} from "@/lib/settings/company-settings-display";
import type {
  CompanyAccountSummary,
  CompanySettingsProfile,
  CompanySettingsQuote,
} from "@/lib/settings/company-settings-types";

async function patchProfile(clientId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/clients/${clientId}/company-profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Couldn't save");
}

async function patchQuote(clientId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/clients/${clientId}/quotation-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Couldn't save");
}

export function CompanyBrandingSection({
  clientId,
  profile,
  quote,
  onProfileChange,
  onQuoteChange,
  toast,
}: {
  clientId: string;
  profile: CompanySettingsProfile;
  quote: CompanySettingsQuote;
  onProfileChange: (next: Partial<CompanySettingsProfile>) => void;
  onQuoteChange: (next: Partial<CompanySettingsQuote>) => void;
  toast: (opts: { title: string; tone?: "success" | "error" | "warning" }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [slug, setSlug] = useState(profile.slug);
  const [tagline, setTagline] = useState(profile.capabilityTagline ?? "");
  const [color, setColor] = useState(profile.primaryColor || "#D4FF4F");
  const [footer, setFooter] = useState(quote.footer_note ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removeLogoOpen, setRemoveLogoOpen] = useState(false);
  const [removeLogoLoading, setRemoveLogoLoading] = useState(false);
  const [removeLogoError, setRemoveLogoError] = useState<string | null>(null);
  const publicUrl = profile.slug ? getPublicLandingPageUrl(profile.slug) : null;

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadClientLogoFile(clientId, file);
      await patchProfile(clientId, { logo_url: uploaded.publicUrl, logo_key: uploaded.key });
      onProfileChange({ logoUrl: uploaded.publicUrl });
      toast({ title: "Company logo updated.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't upload logo", tone: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmRemoveLogo() {
    setRemoveLogoLoading(true);
    setRemoveLogoError(null);
    try {
      await patchProfile(clientId, { logo_url: null });
      onProfileChange({ logoUrl: null });
      toast({ title: "Company logo removed.", tone: "success" });
      setRemoveLogoOpen(false);
    } catch (err) {
      setRemoveLogoError(err instanceof Error ? err.message : "Couldn't remove logo");
    } finally {
      setRemoveLogoLoading(false);
    }
  }

  async function saveIdentity() {
    setSaving(true);
    try {
      const nextSlug = slug.trim().toLowerCase();
      await Promise.all([
        patchProfile(clientId, {
          slug: nextSlug || undefined,
          capability_tagline: tagline.trim() || null,
          primary_color: /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined,
        }),
        patchQuote(clientId, { footer_note: footer.trim() || null }),
      ]);
      onProfileChange({
        slug: nextSlug || profile.slug,
        capabilityTagline: tagline.trim() || null,
        primaryColor: /^#[0-9A-Fa-f]{6}$/.test(color) ? color : profile.primaryColor,
      });
      onQuoteChange({ footer_note: footer.trim() || null });
      toast({ title: "Branding updated.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save branding", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsSectionCard
        title="Brand Identity"
        description="Control how your company appears across SegmiQ documents and customer-facing materials."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Public page ID"
            htmlFor="brand-slug"
            hint="Lowercase letters, numbers, and hyphens. This is also your Company ID."
          >
            <Input id="brand-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label="Brand tagline" htmlFor="brand-tagline">
            <Input
              id="brand-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={200}
            />
          </Field>
        </div>
        {publicUrl ? (
          <p className="mt-3 text-[12px] text-sales-text-secondary">
            Public profile:{" "}
            <a href={publicUrl} className="text-sales-text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </p>
        ) : null}
      </SettingsSectionCard>

      <SettingsSectionCard title="Company Logo" description="Shown on quotations, your public profile, and company workspace.">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface-subtle">
            {profile.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logoUrl} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-[18px] font-semibold text-sales-text-secondary">{companyNameInitials(profile.name)}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="sr-only"
              onChange={(e) => void onUpload(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Upload size={14} />}
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              Upload new logo
            </Button>
            {profile.logoUrl ? (
              <Button variant="ghost" size="md" onClick={() => setRemoveLogoOpen(true)}>
                Remove logo
              </Button>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-[12px] text-sales-text-muted">PNG, JPG, or WebP. SVG is not accepted.</p>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Brand Colors"
        description="Used on your public profile, landing page, and quotation PDFs — not the SegmiQ app chrome."
      >
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-[8px] border border-sales-border bg-sales-surface"
            aria-label="Primary brand color"
          />
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="max-w-[140px]" />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Document Branding"
        description="Footer text printed on quotation PDFs. Quote terms and numbering stay in Quotation settings."
      >
        <Field label="Quote footer" htmlFor="brand-footer">
          <TextArea id="brand-footer" value={footer} onChange={(e) => setFooter(e.target.value)} rows={3} />
        </Field>
        <Link href="/client/quote-settings" className="mt-3 inline-block text-[13px] font-medium text-sales-text-primary underline-offset-2 hover:underline">
          Open quotation settings
        </Link>
      </SettingsSectionCard>

      <div className="flex justify-end">
        <Button variant="primary" size="md" loading={saving} onClick={() => void saveIdentity()}>
          Save changes
        </Button>
      </div>

      <ConfirmDialog
        open={removeLogoOpen}
        onOpenChange={(open) => {
          if (!open && !removeLogoLoading) setRemoveLogoOpen(false);
        }}
        title="Remove company logo"
        description="Your logo will be removed from documents and your public profile until you upload a new one."
        confirmLabel="Remove"
        destructive
        loading={removeLogoLoading}
        error={removeLogoError}
        onConfirm={() => void confirmRemoveLogo()}
      />
    </div>
  );
}

export function CompanyBusinessDetailsSection({
  clientId,
  profile,
  onProfileChange,
  toast,
}: {
  clientId: string;
  profile: CompanySettingsProfile;
  onProfileChange: (next: Partial<CompanySettingsProfile>) => void;
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const [tagline, setTagline] = useState(profile.capabilityTagline ?? "");
  const [hours, setHours] = useState(String(profile.responseTimeLimitHours));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const sla = Math.min(168, Math.max(1, Number(hours) || 2));
      await patchProfile(clientId, {
        capability_tagline: tagline.trim() || null,
        response_time_limit_hours: sla,
      });
      onProfileChange({ capabilityTagline: tagline.trim() || null, responseTimeLimitHours: sla });
      toast({ title: "Business details updated.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsSectionCard
        title="Business Details"
        description="Operational details that sit alongside your company profile."
      >
        <div className="space-y-4">
          <Field label="Capability tagline" htmlFor="bd-tagline">
            <Input id="bd-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} />
          </Field>
          <Field
            label="Lead response SLA (hours)"
            htmlFor="bd-sla"
            hint="Uncontacted-lead alerts use this window."
          >
            <Input id="bd-sla" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="md" loading={saving} onClick={() => void save()}>
            Save changes
          </Button>
        </div>
      </SettingsSectionCard>
    </div>
  );
}

export function CompanyLocalizationSection({
  clientId,
  profile,
  timezone,
  onProfileChange,
  onTimezoneChange,
  toast,
}: {
  clientId: string;
  profile: CompanySettingsProfile;
  timezone: string;
  onProfileChange: (next: Partial<CompanySettingsProfile>) => void;
  onTimezoneChange: (tz: string) => void;
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const [tz, setTz] = useState(timezone);
  const [dial, setDial] = useState(profile.dialCode ?? "263");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        patchProfile(clientId, { dial_code: dial }),
        fetch(`/api/clients/${clientId}/marketing/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: tz }),
        }).then(async (res) => {
          if (!res.ok) throw new Error("Couldn't save timezone");
        }),
      ]);
      onProfileChange({ dialCode: dial });
      onTimezoneChange(tz);
      toast({ title: "Localization updated.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsSectionCard title="Regional Settings" description="Language and phone region for this company.">
        <SettingsInfoGrid rows={[{ label: "Language", value: "English" }]} />
        <p className="mt-2 text-[12px] text-sales-text-muted">SegmiQ is currently available in English only.</p>
        <div className="mt-4">
          <Field label="Default dial code" htmlFor="loc-dial">
            <Select id="loc-dial" value={dial} onChange={(e) => setDial(e.target.value)}>
              {DIAL_CODES.map((code) => (
                <option key={code.value} value={code.value}>
                  {code.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SettingsSectionCard>
      <SettingsSectionCard title="Date & Time" description="IANA timezone used by Calendar, campaigns, and activity display.">
        <Field
          label="Time Zone"
          htmlFor="loc-tz"
          hint="Changing timezone updates display only. Stored timestamps remain UTC."
        >
          <Select id="loc-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
            {COMPANY_TIMEZONES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {COMPANY_TIMEZONES.some((option) => option.value === tz) ? null : <option value={tz}>{tz}</option>}
          </Select>
        </Field>
      </SettingsSectionCard>
      <div className="flex justify-end">
        <Button variant="primary" size="md" loading={saving} onClick={() => void save()}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

export function CompanySubscriptionSection({
  account,
  accountError,
  onRetry,
}: {
  account: CompanyAccountSummary | null;
  accountError?: boolean;
  onRetry: () => void;
}) {
  const planKey = account ? account.planLabel.toLowerCase() : "";
  const features = isCrmPlan(planKey) ? CRM_PLAN_FEATURES[planKey] : null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CompanyAccountSummaryCard account={account} error={accountError} onRetry={onRetry} />
      <SettingsSectionCard title="Plan entitlements" description="Catalogue features for your current plan.">
        {features ? (
          <ul className="space-y-2 text-[13px] text-sales-text-secondary">
            {features.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-sales-text-secondary">Entitlements are shown for Starter, Growth, and Scale plans.</p>
        )}
        <Button variant="primary" size="md" className="mt-4" onClick={() => { window.location.href = "/client/billing"; }}>
          Manage Subscription
        </Button>
      </SettingsSectionCard>
    </div>
  );
}

export function CompanyPreferencesSection({
  clientId,
  quote,
  profile,
  onQuoteChange,
  onProfileChange,
  toast,
}: {
  clientId: string;
  quote: CompanySettingsQuote;
  profile: CompanySettingsProfile;
  onQuoteChange: (next: Partial<CompanySettingsQuote>) => void;
  onProfileChange: (next: Partial<CompanySettingsProfile>) => void;
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const [prefix, setPrefix] = useState(quote.quote_prefix ?? "Q");
  const [tax, setTax] = useState(String(quote.default_tax_rate ?? 0));
  const [terms, setTerms] = useState(quote.default_terms ?? "");
  const [saving, setSaving] = useState(false);
  const [agencyBusy, setAgencyBusy] = useState(false);

  async function saveQuotes() {
    setSaving(true);
    try {
      await patchQuote(clientId, {
        quote_prefix: prefix.trim() || "Q",
        default_tax_rate: Number(tax) || 0,
        default_terms: terms.trim() || null,
      });
      onQuoteChange({
        quote_prefix: prefix.trim() || "Q",
        default_tax_rate: Number(tax) || 0,
        default_terms: terms.trim() || null,
      });
      toast({ title: "Preferences updated.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleAgency(next: boolean) {
    const ok = window.confirm(
      next
        ? "Enable SegmiQ managed marketing for this account?"
        : "Remove managed agency service? Your CRM data stays."
    );
    if (!ok) return;
    setAgencyBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/agency-managed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency_managed: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't update managed service");
      onProfileChange({ agencyManaged: next });
      toast({ title: next ? "Managed marketing enabled." : "Managed marketing removed.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't update", tone: "error" });
    } finally {
      setAgencyBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsSectionCard
        title="Quotation defaults"
        description="Default numbering, tax, and terms for new quotations."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quote prefix" htmlFor="pref-prefix">
            <Input id="pref-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          </Field>
          <Field label="Default tax rate (%)" htmlFor="pref-tax">
            <Input id="pref-tax" value={tax} onChange={(e) => setTax(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Default terms" htmlFor="pref-terms">
            <TextArea id="pref-terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="md" loading={saving} onClick={() => void saveQuotes()}>
            Save changes
          </Button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Managed marketing"
        description={
          profile.agencyManaged
            ? "SegmiQ operates Meta and marketing for this account."
            : "Self-serve — you can enable managed service if you want SegmiQ to operate Meta and campaigns."
        }
      >
        <Button
          variant="secondary"
          size="md"
          loading={agencyBusy}
          onClick={() => void toggleAgency(!profile.agencyManaged)}
        >
          {profile.agencyManaged ? "Remove managed service" : "Enable managed service"}
        </Button>
      </SettingsSectionCard>
    </div>
  );
}

export function CompanyAutomationSection({
  clientId,
  profile,
  onProfileChange,
  toast,
}: {
  clientId: string;
  profile: CompanySettingsProfile;
  onProfileChange: (next: Partial<CompanySettingsProfile>) => void;
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const [mode, setMode] = useState(profile.assignmentMode || "direct");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (mode === profile.assignmentMode) return;
    setSaving(true);
    try {
      await patchProfile(clientId, { assignment_mode: mode });
      onProfileChange({ assignmentMode: mode });
      toast({ title: "Lead assignment updated.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSectionCard
      title="Lead Assignment"
      description="How new leads are routed to salespeople. This uses the existing assignment engine."
    >
      <div className="space-y-3">
        <Radio
          name="assignment"
          value="direct"
          checked={mode === "direct"}
          onChange={() => setMode("direct")}
          label="Direct assignment"
        />
        <p className="pl-7 text-[12px] text-sales-text-muted">Managers assign each lead to a specific salesperson.</p>
        <Radio
          name="assignment"
          value="pool"
          checked={mode === "pool"}
          onChange={() => setMode("pool")}
          label="Open pool"
        />
        <p className="pl-7 text-[12px] text-sales-text-muted">Leads sit in a shared pool until claimed.</p>
        <Radio
          name="assignment"
          value="round_robin"
          checked={mode === "round_robin"}
          onChange={() => setMode("round_robin")}
          label="Round robin"
        />
        <p className="pl-7 text-[12px] text-sales-text-muted">New leads rotate across eligible salespeople.</p>
      </div>
      <p className="mt-4 text-[13px] text-sales-text-secondary">Current: {assignmentModeLabel(profile.assignmentMode)}</p>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" size="md" loading={saving} disabled={mode === profile.assignmentMode} onClick={() => void save()}>
          Save changes
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

export function CompanyDataSection() {
  return (
    <SettingsSectionCard
      title="Export Data"
      description="Company reports export live CRM metrics. There is no separate CSV importer or retention policy in Settings."
    >
      <p className="text-[13px] text-sales-text-secondary">
        Use Reports to export the datasets your role can access. Exports stay inside this company.
      </p>
        <Button variant="primary" size="md" className="mt-4" onClick={() => { window.location.href = "/client/reports"; }}>
          Open Reports
        </Button>
    </SettingsSectionCard>
  );
}
