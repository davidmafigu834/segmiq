"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { CRM_PLANS, ONBOARDING_COUNTRIES, type OnboardingCountryCode } from "@/lib/onboarding/constants";
import { suggestSlugFromName } from "@/lib/onboarding/slug";

const PLAN_LABELS: Record<(typeof CRM_PLANS)[number], string> = {
  starter: "Starter",
  professional: "Professional",
  business: "Business",
};

type CreationMode = "invite" | "manual";

export function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [creationMode, setCreationMode] = useState<CreationMode>("invite");
  const [soloOperator, setSoloOperator] = useState(false);
  const [plan, setPlan] = useState<(typeof CRM_PLANS)[number]>("starter");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState<OnboardingCountryCode>("ZW");
  const [website, setWebsite] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCreationMode("invite");
    setSoloOperator(false);
    setPlan("starter");
    setOwnerEmail("");
    setCompanyName("");
    setIndustry("");
    setCountry("ZW");
    setWebsite("");
    setSlug("");
    setSlugTouched(false);
    setSlugAvailable(null);
    setCheckingSlug(false);
    setOwnerName("");
    setOwnerPhone("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setError(null);
    setSuccess(null);
  }, [open, reset]);

  useEffect(() => {
    if (creationMode !== "manual" || slugTouched || !companyName) return;
    setSlug(suggestSlugFromName(companyName));
  }, [companyName, slugTouched, creationMode]);

  useEffect(() => {
    if (creationMode !== "manual") return;
    const norm = slug.trim().toLowerCase();
    if (!norm || !/^[a-z0-9-]+$/.test(norm)) {
      setSlugAvailable(null);
      return;
    }

    const timer = setTimeout(() => {
      setCheckingSlug(true);
      fetch(`/api/clients/check-slug?slug=${encodeURIComponent(norm)}`)
        .then((r) => r.json())
        .then((data: { available?: boolean }) => {
          setSlugAvailable(Boolean(data.available));
        })
        .catch(() => setSlugAvailable(null))
        .finally(() => setCheckingSlug(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [slug, creationMode]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!ownerEmail.trim()) {
      setError("Owner email is required.");
      return;
    }

    if (creationMode === "manual") {
      if (!companyName.trim()) {
        setError("Company name is required.");
        return;
      }
      if (!industry.trim()) {
        setError("Industry is required.");
        return;
      }
      const slugNorm = slug.trim().toLowerCase();
      if (!slugNorm) {
        setError("URL slug is required.");
        return;
      }
      if (!/^[a-z0-9-]+$/.test(slugNorm)) {
        setError("Slug must use lowercase letters, numbers, and hyphens only.");
        return;
      }
      if (slugAvailable === false) {
        setError("This slug is already taken.");
        return;
      }
      if (!ownerName.trim()) {
        setError("Owner name is required.");
        return;
      }
      if (soloOperator && !ownerPhone.trim()) {
        setError("WhatsApp number is required for solo clients.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = creationMode === "manual" ? "/api/clients/manual" : "/api/clients";
      const body =
        creationMode === "manual"
          ? {
              mode: soloOperator ? "solo" : "team",
              plan,
              ownerEmail: ownerEmail.trim(),
              password,
              companyName: companyName.trim(),
              industry: industry.trim(),
              country,
              slug: slug.trim().toLowerCase(),
              website: website.trim() || undefined,
              ownerName: ownerName.trim(),
              ownerPhone: ownerPhone.trim() || undefined,
            }
          : {
              mode: soloOperator ? "solo" : "team",
              plan,
              ownerEmail: ownerEmail.trim(),
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        client?: { id?: string };
        emailSent?: boolean;
      };

      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Could not create client");
        return;
      }

      const id = j.client?.id;
      if (!id) {
        setError("Created but no client id returned.");
        return;
      }

      setSuccess(
        creationMode === "manual"
          ? "Client created and ready to use."
          : j.emailSent
            ? "Onboarding link sent. The client can complete setup from their email."
            : "Client shell created, but the email failed to send. Resend the link from the client overview."
      );

      setTimeout(() => {
        onClose();
        reset();
        router.push(`/dashboard/clients/${id}`);
        router.refresh();
      }, 1200);
    } finally {
      setSubmitting(false);
    }
  }

  const cloudDomain =
    process.env.NEXT_PUBLIC_CLOUD_DOMAIN?.replace(/^https?:\/\//, "") ?? "cloud.segmiq.com";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-overlay md:items-center md:justify-center md:px-4 md:py-8">
      <div className="flex h-full w-full flex-col border border-border bg-surface-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-lg">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:h-auto md:border-b-0 md:px-6 md:pt-6">
          <button type="button" className="flex h-9 w-9 items-center justify-center md:hidden" onClick={onClose} aria-label="Back">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <h2 className="min-w-0 flex-1 truncate font-display text-xl text-ink-primary">New client</h2>
          <button
            type="button"
            className="hidden text-ink-tertiary hover:text-ink-primary md:block"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pt-2">
            <p className="mt-2 text-sm text-ink-secondary">
              {creationMode === "invite"
                ? "Send a self-serve onboarding link, or create the client yourself with company and account details."
                : "Set up the client company and owner account now. They can log in immediately with the password you choose."}
            </p>

            <div className="mt-4 flex rounded-lg border border-border bg-surface-card-alt p-1">
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                  creationMode === "invite"
                    ? "bg-surface-card text-ink-primary shadow-sm"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
                onClick={() => setCreationMode("invite")}
              >
                Send invite link
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                  creationMode === "manual"
                    ? "bg-surface-card text-ink-primary shadow-sm"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
                onClick={() => setCreationMode("manual")}
              >
                Create manually
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-card-alt px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={soloOperator}
                  onChange={(e) => setSoloOperator(e.target.checked)}
                />
                <span>
                  <span className="block text-[13px] font-semibold text-ink-primary">Solo operator</span>
                  <span className="block text-[12px] text-ink-secondary">
                    One owner runs the whole business — no manager or sales team.
                  </span>
                </span>
              </label>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Plan *</label>
                <select
                  className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as (typeof CRM_PLANS)[number])}
                  required
                >
                  {CRM_PLANS.map((p) => (
                    <option key={p} value={p}>
                      {PLAN_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              {creationMode === "manual" ? (
                <>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Company name *</label>
                    <input
                      type="text"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      placeholder="Acme Builders"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Industry *</label>
                    <input
                      type="text"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      required
                      placeholder="Construction"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Country *</label>
                    <select
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={country}
                      onChange={(e) => setCountry(e.target.value as OnboardingCountryCode)}
                      required
                    >
                      {ONBOARDING_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">URL slug *</label>
                    <input
                      type="text"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(e.target.value);
                      }}
                      required
                      placeholder="acme-builders"
                    />
                    <p className="mt-1 text-xs text-ink-tertiary">
                      {cloudDomain}/{slug.trim() || "your-slug"}
                      {checkingSlug ? " · Checking…" : null}
                      {!checkingSlug && slugAvailable === true ? " · Available" : null}
                      {!checkingSlug && slugAvailable === false ? " · Already taken" : null}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Website</label>
                    <input
                      type="url"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Owner name *</label>
                    <input
                      type="text"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                      placeholder="Jane Doe"
                    />
                  </div>
                </>
              ) : null}

              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Owner email *</label>
                <input
                  type="email"
                  className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  required
                  autoFocus={creationMode === "invite"}
                  placeholder="owner@company.com"
                />
                {creationMode === "invite" ? (
                  <p className="mt-1 text-xs text-ink-tertiary">
                    We&apos;ll email them a link to complete setup. They choose their password during onboarding.
                  </p>
                ) : null}
              </div>

              {creationMode === "manual" ? (
                <>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                      {soloOperator ? "WhatsApp number *" : "Owner phone"}
                    </label>
                    <input
                      type="tel"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      required={soloOperator}
                      placeholder="+263 77 123 4567"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Password *</label>
                    <input
                      type="password"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Confirm password *</label>
                    <input
                      type="password"
                      className="input-base h-11 w-full text-base md:h-10 md:text-sm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                </>
              ) : null}

              {error ? <p className="text-sm text-[var(--status-lost-fg)]">{error}</p> : null}
              {success ? <p className="text-sm text-[var(--success-fg)]">{success}</p> : null}
            </div>
          </div>
          <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-border p-4 md:px-6 md:pb-6">
            <button type="button" className="btn-ghost h-11 flex-1 md:h-9 md:flex-none" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary h-11 flex-1 md:h-9 md:flex-none" disabled={submitting}>
              {submitting
                ? creationMode === "manual"
                  ? "Creating…"
                  : "Sending…"
                : creationMode === "manual"
                  ? "Create client"
                  : "Send onboarding link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
