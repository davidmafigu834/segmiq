"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import { getPublicLandingPageUrl } from "@/lib/public-url";

const INDUSTRY_SUGGESTIONS = [
  "Construction",
  "Solar",
  "Legal",
  "Real Estate",
  "Medical",
  "Cleaning",
  "HVAC",
  "Landscaping",
  "Roofing",
  "Plumbing",
];

type ClientProfile = {
  id: string;
  name: string;
  industry: string | null;
  slug: string;
  logo_url: string | null;
  response_time_limit_hours: number;
  dial_code: string | null;
  primary_color: string | null;
};

function Field({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[--text-tertiary]">{label}</span>
      {caption ? <p className="mt-0.5 mb-1.5 text-xs text-[--text-secondary]">{caption}</p> : <div className="mb-1.5" />}
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-[--border] bg-[--surface-card] px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-tertiary] disabled:cursor-not-allowed disabled:bg-[--surface-card-alt] disabled:text-[--text-tertiary]"
    />
  );
}

export function CompanyProfileManager({
  clientId,
  agencyDefaultHours,
}: {
  clientId: string;
  agencyDefaultHours: number;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    industry: "",
    slug: "",
    logo_url: "",
    response_time_limit_hours: agencyDefaultHours,
    dial_code: "263",
    primary_color: "#00D4FF",
  });

  useEffect(() => {
    fetch(`/api/clients/${clientId}/company-profile`)
      .then((r) => r.json())
      .then((j: { client?: ClientProfile; error?: string }) => {
        if (j.client) {
          const c = j.client;
          setForm({
            name: c.name ?? "",
            industry: c.industry ?? "",
            slug: c.slug ?? "",
            logo_url: c.logo_url ?? "",
            response_time_limit_hours: c.response_time_limit_hours ?? agencyDefaultHours,
            dial_code: c.dial_code ?? "263",
            primary_color: c.primary_color ?? "#00D4FF",
          });
        } else if (j.error) {
          setError(j.error);
        }
      })
      .finally(() => setLoading(false));
  }, [clientId, agencyDefaultHours]);

  useEffect(() => {
    if (!profileSaved && !brandingSaved) return;
    const t = window.setTimeout(() => {
      setProfileSaved(false);
      setBrandingSaved(false);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [profileSaved, brandingSaved]);

  async function patchProfile(body: Record<string, unknown>) {
    const res = await fetch(`/api/clients/${clientId}/company-profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { client?: ClientProfile; error?: string };
    if (!res.ok) throw new Error(j.error ?? "Save failed");
    if (j.client) {
      setForm((prev) => ({
        ...prev,
        name: j.client!.name ?? prev.name,
        industry: j.client!.industry ?? prev.industry,
        slug: j.client!.slug ?? prev.slug,
        logo_url: j.client!.logo_url ?? "",
        response_time_limit_hours: j.client!.response_time_limit_hours ?? prev.response_time_limit_hours,
        dial_code: j.client!.dial_code ?? prev.dial_code,
        primary_color: j.client!.primary_color ?? prev.primary_color,
      }));
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setError(null);
    try {
      await patchProfile({
        name: form.name.trim(),
        industry: form.industry.trim(),
        slug: form.slug.trim(),
        logo_url: form.logo_url.trim() || null,
        response_time_limit_hours: form.response_time_limit_hours,
        dial_code: form.dial_code.trim() || null,
      });
      setProfileSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveBranding() {
    setSavingBranding(true);
    setError(null);
    try {
      await patchProfile({ primary_color: form.primary_color });
      setBrandingSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleLogoFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setLogoError("File too large. Max 5 MB.");
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const uploadRes = await fetch(`/api/clients/${clientId}/logo/upload`, {
        method: "POST",
        body,
      });
      const payload = (await uploadRes.json().catch(() => ({}))) as {
        publicUrl?: string;
        key?: string;
        error?: string;
      };
      if (!uploadRes.ok || !payload.publicUrl || !payload.key) {
        throw new Error(payload.error ?? "Upload failed");
      }
      await patchProfile({ logo_url: payload.publicUrl, logo_key: payload.key });
      setForm((f) => ({ ...f, logo_url: payload.publicUrl! }));
      setLogoPreview(null);
      setProfileSaved(true);
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  if (loading) return <p className="text-sm text-[--text-secondary]">Loading…</p>;

  const publicUrl = form.slug ? getPublicLandingPageUrl(form.slug) : null;
  const logoSrc = logoPreview ?? (form.logo_url || null);

  return (
    <div className="space-y-12">
      {error ? (
        <div className="rounded-md border border-[--danger-border] bg-[--danger-bg] px-3 py-2 text-sm text-[--danger]">
          {error}
        </div>
      ) : null}

      <section className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl text-[--text-primary]">Company profile</h2>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Your business name, logo, and lead-handling defaults. Agency default SLA: {agencyDefaultHours}h.
          </p>
        </div>

        <div className="grid max-w-lg gap-5">
          <Field label="Company name">
            <TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>

          <Field label="Industry">
            <TextInput
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              list="manager-industry-suggestions"
            />
            <datalist id="manager-industry-suggestions">
              {INDUSTRY_SUGGESTIONS.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>

          <Field label="Subdomain slug" caption={publicUrl ? `Public page: ${publicUrl}` : undefined}>
            <TextInput
              className="font-mono"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
            />
          </Field>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[--text-tertiary]">Logo</span>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <ClientAvatar name={form.name || "Company"} size={72} src={logoSrc} />
              <div className="space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setLogoPreview(URL.createObjectURL(file));
                      void handleLogoFile(file);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="inline-flex items-center gap-2 rounded-md border border-[--border] bg-[--surface-card] px-3 py-2 text-sm text-[--text-primary] disabled:opacity-50"
                >
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingLogo ? "Uploading…" : "Upload logo"}
                </button>
                <Field label="Or paste logo URL">
                  <TextInput
                    value={form.logo_url}
                    onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                    placeholder="https://…"
                  />
                </Field>
              </div>
            </div>
            {logoError ? <p className="mt-2 text-xs text-[--danger]">{logoError}</p> : null}
          </div>

          <Field label="Response time limit (hours)" caption="Alerts fire if a new lead isn't contacted within this window.">
            <TextInput
              type="number"
              min={1}
              max={168}
              value={form.response_time_limit_hours}
              onChange={(e) =>
                setForm((f) => ({ ...f, response_time_limit_hours: Number(e.target.value) || 1 }))
              }
            />
          </Field>

          <Field label="Default country dial code">
            <select
              className="w-full rounded-md border border-[--border] bg-[--surface-card] px-3 py-2 text-sm text-[--text-primary]"
              value={form.dial_code}
              onChange={(e) => setForm((f) => ({ ...f, dial_code: e.target.value }))}
            >
              <option value="263">Zimbabwe (+263)</option>
              <option value="260">Zambia (+260)</option>
              <option value="27">South Africa (+27)</option>
              <option value="254">Kenya (+254)</option>
            </select>
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={savingProfile || uploadingLogo}
            className="rounded-md bg-[--surface-sidebar] px-5 py-2.5 text-sm font-medium text-[--text-on-dark] disabled:opacity-40"
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
          {profileSaved ? (
            <span className="flex items-center gap-1.5 text-sm text-[--success]">
              <Check className="h-4 w-4" /> Saved
            </span>
          ) : null}
        </div>
      </section>

      <hr className="border-[--border]" />

      <section className="max-w-lg space-y-6">
        <div>
          <h2 className="font-serif text-2xl text-[--text-primary]">Branding</h2>
          <p className="mt-1 text-sm text-[--text-secondary]">Accent color used on your public profile and lead pages.</p>
        </div>

        <Field label="Primary color">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primary_color}
              onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
              className="h-10 w-14 cursor-pointer rounded border border-[--border] bg-transparent p-0"
            />
            <TextInput
              className="font-mono"
              value={form.primary_color}
              onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
            />
          </div>
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveBranding()}
            disabled={savingBranding}
            className="rounded-md bg-[--surface-sidebar] px-5 py-2.5 text-sm font-medium text-[--text-on-dark] disabled:opacity-40"
          >
            {savingBranding ? "Saving…" : "Save branding"}
          </button>
          {brandingSaved ? (
            <span className="flex items-center gap-1.5 text-sm text-[--success]">
              <Check className="h-4 w-4" /> Saved
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
