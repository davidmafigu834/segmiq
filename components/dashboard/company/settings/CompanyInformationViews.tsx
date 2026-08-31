"use client";

import { useMemo, useState } from "react";
import { Button, Field, Input, Select, TextArea } from "@/components/sales/ui";
import { SettingsSectionCard, SettingsInfoGrid } from "./SettingsSectionCard";
import { SettingsFormDrawer } from "./SettingsFormDrawer";
import { companyNameInitials } from "@/lib/sales/navigation/company-nav-config";
import {
  INDUSTRY_OPTIONS,
  COMPANY_TIMEZONES,
  isValidEmail,
  normalizeWebsite,
} from "@/lib/settings/company-settings-config";
import {
  businessTypeLabel,
  companyInformationRows,
  confirmDiscardUnsaved,
  displayOrDash,
  operatingHoursLabel,
  timezoneLabel,
} from "@/lib/settings/company-settings-display";
import type {
  CompanyOperatingHours,
  CompanySettingsProfile,
  CompanySettingsQuote,
} from "@/lib/settings/company-settings-types";
import { OperatingHoursFields } from "@/components/settings/OperatingHoursFields";
import { defaultOperatingHours } from "@/lib/sales/intelligence/operating-hours";

async function patchProfile(clientId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/clients/${clientId}/company-profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; client?: Record<string, unknown> };
  if (!res.ok) throw new Error(json.error ?? "Couldn't save company details");
  return json.client;
}

async function patchQuote(clientId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/clients/${clientId}/quotation-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Couldn't save quotation details");
}

export function CompanyInformationSection({
  clientId,
  profile,
  quote,
  timezone,
  operatingHours,
  profileError,
  quoteError,
  onRetry,
  onProfileChange,
  onQuoteChange,
  onTimezoneChange,
  onOperatingHoursChange,
  toast,
}: {
  clientId: string;
  profile: CompanySettingsProfile;
  quote: CompanySettingsQuote;
  timezone: string;
  operatingHours: CompanyOperatingHours;
  profileError?: boolean;
  quoteError?: boolean;
  onRetry: () => void;
  onProfileChange: (next: Partial<CompanySettingsProfile>) => void;
  onQuoteChange: (next: Partial<CompanySettingsQuote>) => void;
  onTimezoneChange: (tz: string) => void;
  onOperatingHoursChange: (next: CompanyOperatingHours) => void;
  toast: (opts: { title: string; tone?: "success" | "error" | "warning" }) => void;
}) {
  const [edit, setEdit] = useState<"info" | "address" | "business" | "hours" | null>(null);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsSectionCard
        title="Company Information"
        description="Update your company details and basic information."
        onEdit={profileError ? undefined : () => setEdit("info")}
      >
        {profileError ? (
          <div>
            <p className="text-[13px] text-sales-text-secondary">We couldn&apos;t load company information.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <CompanyLogoMark name={profile.name} src={profile.logoUrl} />
            <div className="min-w-0 flex-1">
              <SettingsInfoGrid rows={companyInformationRows(profile, quote)} />
            </div>
          </div>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Business Address"
        description="Your registered business address."
        onEdit={quoteError ? undefined : () => setEdit("address")}
      >
        {quoteError ? (
          <div>
            <p className="text-[13px] text-sales-text-secondary">We couldn&apos;t load the business address.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : (
          <SettingsInfoGrid
            rows={[
              { label: "Address", value: displayOrDash(quote.company_address) },
              { label: "Country", value: displayOrDash(profile.country) },
            ]}
          />
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Business Information"
        description="Additional information about your business."
        onEdit={() => setEdit("business")}
      >
        <SettingsInfoGrid
          rows={[
            { label: "Business Type", value: businessTypeLabel(profile.businessType) },
            { label: "Years in operation", value: profile.yearsInOperation == null ? "—" : String(profile.yearsInOperation) },
            { label: "Time Zone", value: timezoneLabel(timezone) },
          ]}
        />
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Operating hours"
        description="Working days and hours used for goal days left and today’s plan."
        onEdit={() => setEdit("hours")}
      >
        <SettingsInfoGrid
          rows={[
            { label: "Schedule", value: operatingHoursLabel(operatingHours) },
            { label: "Time Zone", value: timezoneLabel(timezone) },
          ]}
        />
      </SettingsSectionCard>

      {edit === "info" ? (
        <EditCompanyInformationDrawer
          clientId={clientId}
          profile={profile}
          quote={quote}
          onClose={() => setEdit(null)}
          onSaved={(nextProfile, nextQuote) => {
            onProfileChange(nextProfile);
            onQuoteChange(nextQuote);
            setEdit(null);
            toast({ title: "Company information updated.", tone: "success" });
          }}
          onError={(msg) => toast({ title: msg, tone: "error" })}
        />
      ) : null}
      {edit === "address" ? (
        <EditBusinessAddressDrawer
          clientId={clientId}
          profile={profile}
          quote={quote}
          onClose={() => setEdit(null)}
          onSaved={(nextProfile, nextQuote) => {
            onProfileChange(nextProfile);
            onQuoteChange(nextQuote);
            setEdit(null);
            toast({ title: "Business address updated.", tone: "success" });
          }}
          onError={(msg) => toast({ title: msg, tone: "error" })}
        />
      ) : null}
      {edit === "business" ? (
        <EditBusinessInformationDrawer
          clientId={clientId}
          profile={profile}
          timezone={timezone}
          onClose={() => setEdit(null)}
          onSaved={(nextProfile, tz) => {
            onProfileChange(nextProfile);
            onTimezoneChange(tz);
            setEdit(null);
            toast({ title: "Business information updated.", tone: "success" });
          }}
          onError={(msg) => toast({ title: msg, tone: "error" })}
        />
      ) : null}
      {edit === "hours" ? (
        <EditOperatingHoursDrawer
          hours={operatingHours}
          onClose={() => setEdit(null)}
          onSaved={(next) => {
            onOperatingHoursChange(next);
            setEdit(null);
            toast({ title: "Operating hours updated.", tone: "success" });
          }}
          onError={(msg) => toast({ title: msg, tone: "error" })}
        />
      ) : null}
    </div>
  );
}

function CompanyLogoMark({ name, src }: { name: string; src: string | null }) {
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface-subtle">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className="text-[16px] font-semibold tracking-wide text-sales-text-secondary">
          {companyNameInitials(name)}
        </span>
      )}
    </div>
  );
}

function EditCompanyInformationDrawer({
  clientId,
  profile,
  quote,
  onClose,
  onSaved,
  onError,
}: {
  clientId: string;
  profile: CompanySettingsProfile;
  quote: CompanySettingsQuote;
  onClose: () => void;
  onSaved: (profile: Partial<CompanySettingsProfile>, quote: Partial<CompanySettingsQuote>) => void;
  onError: (message: string) => void;
}) {
  const initialEmail = quote.company_email || profile.ownerEmail || "";
  const initialWebsite = quote.company_website || profile.website || "";
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(quote.company_phone ?? "");
  const [website, setWebsite] = useState(initialWebsite);
  const [industry, setIndustry] = useState(profile.industry ?? "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = useMemo(
    () =>
      name.trim() !== profile.name ||
      email.trim() !== initialEmail ||
      phone.trim() !== (quote.company_phone ?? "") ||
      website.trim() !== initialWebsite ||
      industry.trim() !== (profile.industry ?? ""),
    [name, email, phone, website, industry, profile.name, profile.industry, initialEmail, initialWebsite, quote.company_phone]
  );

  function requestClose() {
    if (dirty && !confirmDiscardUnsaved()) return;
    onClose();
  }

  async function save() {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Company name is required.";
    if (email.trim() && !isValidEmail(email)) nextErrors.email = "Enter a valid company email.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    try {
      const websiteNorm = website.trim() ? normalizeWebsite(website) : null;
      const emailNorm = email.trim().toLowerCase() || null;
      await Promise.all([
        patchProfile(clientId, {
          name: name.trim(),
          industry: industry.trim() || undefined,
          owner_email: emailNorm,
          website: websiteNorm,
        }),
        patchQuote(clientId, {
          company_email: emailNorm,
          company_website: websiteNorm,
          company_phone: phone.trim() || null,
        }),
      ]);
      onSaved(
        { name: name.trim(), industry: industry.trim() || null, ownerEmail: emailNorm, website: websiteNorm },
        { company_email: emailNorm, company_website: websiteNorm, company_phone: phone.trim() || null }
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save company information");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsFormDrawer
      title="Edit Company Information"
      description="These details appear on quotations and your public company profile. Company email is not your login email."
      onClose={requestClose}
      onSave={() => void save()}
      saving={saving}
    >
      <div>
        <Field label="Company Name" htmlFor="co-name" error={errors.name || undefined}>
          <Input id="co-name" value={name} onChange={(e) => setName(e.target.value)} invalid={Boolean(errors.name)} />
        </Field>
        <Field
          label="Company Email"
          htmlFor="co-email"
          error={errors.email || undefined}
          hint={errors.email ? undefined : "Used on quotes and customer-facing materials."}
        >
          <Input
            id="co-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(errors.email)}
          />
        </Field>
        <Field label="Phone Number" htmlFor="co-phone">
          <Input id="co-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Website" htmlFor="co-web">
          <Input id="co-web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="segmiq.com" />
        </Field>
        <Field label="Industry" htmlFor="co-industry">
          <Input id="co-industry" list="industry-options" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          <datalist id="industry-options">
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </Field>
        <Field label="Company ID" hint="Public company identifier. Change it under Branding.">
          <Input value={profile.slug} disabled />
        </Field>
      </div>
    </SettingsFormDrawer>
  );
}

function EditBusinessAddressDrawer({
  clientId,
  profile,
  quote,
  onClose,
  onSaved,
  onError,
}: {
  clientId: string;
  profile: CompanySettingsProfile;
  quote: CompanySettingsQuote;
  onClose: () => void;
  onSaved: (profile: Partial<CompanySettingsProfile>, quote: Partial<CompanySettingsQuote>) => void;
  onError: (message: string) => void;
}) {
  const [address, setAddress] = useState(quote.company_address ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = address !== (quote.company_address ?? "") || country !== (profile.country ?? "");

  function requestClose() {
    if (dirty && !confirmDiscardUnsaved()) return;
    onClose();
  }

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        patchQuote(clientId, { company_address: address.trim() || null }),
        patchProfile(clientId, { country: country.trim() || null }),
      ]);
      onSaved({ country: country.trim() || null }, { company_address: address.trim() || null });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save address");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsFormDrawer
      title="Edit Business Address"
      description="This address is printed on quotations. It does not change your billing address."
      onClose={requestClose}
      onSave={() => void save()}
      saving={saving}
    >
      <Field label="Address" htmlFor="co-address">
        <TextArea id="co-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
      </Field>
      <Field label="Country" htmlFor="co-country">
        <Input id="co-country" value={country} onChange={(e) => setCountry(e.target.value)} />
      </Field>
    </SettingsFormDrawer>
  );
}

function EditBusinessInformationDrawer({
  clientId,
  profile,
  timezone,
  onClose,
  onSaved,
  onError,
}: {
  clientId: string;
  profile: CompanySettingsProfile;
  timezone: string;
  onClose: () => void;
  onSaved: (profile: Partial<CompanySettingsProfile>, timezone: string) => void;
  onError: (message: string) => void;
}) {
  const [businessType, setBusinessType] = useState(profile.businessType === "real_estate" ? "real_estate" : "trades");
  const [years, setYears] = useState(profile.yearsInOperation == null ? "" : String(profile.yearsInOperation));
  const [tz, setTz] = useState(timezone);
  const [saving, setSaving] = useState(false);
  const dirty =
    businessType !== profile.businessType ||
    years !== (profile.yearsInOperation == null ? "" : String(profile.yearsInOperation)) ||
    tz !== timezone;

  function requestClose() {
    if (dirty && !confirmDiscardUnsaved()) return;
    onClose();
  }

  async function save() {
    setSaving(true);
    try {
      const yearsNum = years.trim() === "" ? null : Number(years);
      await Promise.all([
        patchProfile(clientId, {
          business_type: businessType,
          years_in_operation: yearsNum,
        }),
        fetch(`/api/clients/${clientId}/marketing/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: tz }),
        }).then(async (res) => {
          if (!res.ok) {
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(json.error ?? "Couldn't save timezone");
          }
        }),
      ]);
      onSaved({ businessType, yearsInOperation: yearsNum }, tz);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save business information");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsFormDrawer
      title="Edit Business Information"
      onClose={requestClose}
      onSave={() => void save()}
      saving={saving}
    >
      <Field label="Business Type" htmlFor="co-type">
        <Select id="co-type" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
          <option value="trades">Trades</option>
          <option value="real_estate">Real estate</option>
        </Select>
      </Field>
      <Field label="Years in operation" htmlFor="co-years">
        <Input
          id="co-years"
          inputMode="numeric"
          value={years}
          onChange={(e) => setYears(e.target.value.replace(/[^\d]/g, ""))}
        />
      </Field>
      <Field
        label="Time Zone"
        htmlFor="co-tz"
        hint="Stored as an IANA timezone. Existing timestamps stay in UTC."
      >
        <Select id="co-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
          {COMPANY_TIMEZONES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {COMPANY_TIMEZONES.some((option) => option.value === tz) ? null : <option value={tz}>{tz}</option>}
        </Select>
      </Field>
    </SettingsFormDrawer>
  );
}

function EditOperatingHoursDrawer({
  hours,
  onClose,
  onSaved,
  onError,
}: {
  hours: CompanyOperatingHours;
  onClose: () => void;
  onSaved: (hours: CompanyOperatingHours) => void;
  onError: (message: string) => void;
}) {
  const fallback = defaultOperatingHours();
  const [workingDays, setWorkingDays] = useState(
    hours.workingDays.length ? hours.workingDays : fallback.workingDays
  );
  const [workStartTime, setWorkStartTime] = useState(hours.workStartTime || fallback.workStartTime);
  const [workEndTime, setWorkEndTime] = useState(hours.workEndTime || fallback.workEndTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    workingDays.slice().sort().join(",") !== hours.workingDays.slice().sort().join(",") ||
    workStartTime !== hours.workStartTime ||
    workEndTime !== hours.workEndTime;

  function requestClose() {
    if (dirty && !confirmDiscardUnsaved()) return;
    onClose();
  }

  async function save() {
    if (workingDays.length === 0) {
      setError("Select at least one working day.");
      return;
    }
    if (workEndTime <= workStartTime) {
      setError("Work end time must be after start time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/execution-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "client",
          workingDays,
          workStartTime,
          workEndTime,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't save operating hours");
      onSaved({ workingDays, workStartTime, workEndTime });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save operating hours");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsFormDrawer
      title="Edit operating hours"
      description="Goals count remaining working days, and today’s plan uses these hours in the company timezone."
      onClose={requestClose}
      onSave={() => void save()}
      saving={saving}
    >
      <OperatingHoursFields
        workingDays={workingDays}
        workStartTime={workStartTime}
        workEndTime={workEndTime}
        onWorkingDaysChange={(days) => {
          setError(null);
          setWorkingDays(days);
        }}
        onStartChange={setWorkStartTime}
        onEndChange={setWorkEndTime}
        hint="Default is Monday–Friday, 8:00am–5:00pm. Salespeople can override this on Goals."
      />
      {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
    </SettingsFormDrawer>
  );
}
