"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2, Upload } from "lucide-react";
import {
  ONBOARDING_COUNTRIES,
  type OnboardingCountryCode,
  type OnboardingProgress,
  type OnboardingStepId,
  stepsForMode,
} from "@/lib/onboarding/constants";
import { suggestSlugFromName } from "@/lib/onboarding/slug";

const STEP_LABELS: Record<OnboardingStepId, string> = {
  company: "Company",
  account: "Your account",
  branding: "Branding",
  team: "Sales team",
  review: "Review",
};

const STEP_HEADINGS: Record<OnboardingStepId, string> = {
  company: "Company details",
  account: "Your account",
  branding: "Upload your logo",
  team: "Add your sales team",
  review: "Review and finish",
};

type Props = {
  token: string;
  mode: "team" | "solo";
  ownerEmail: string;
  initialProgress: OnboardingProgress;
  initialStep: OnboardingStepId;
};

type FieldErrors = Record<string, string>;

const inputClass =
  "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-input)] px-[11px] py-[11px] text-[14px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(212,255,79,0.12)]";

const labelClass = "mb-1.5 block text-[13px] font-medium text-[var(--text-primary)]";

export function OnboardingWizard({ token, mode, ownerEmail, initialProgress, initialStep }: Props) {
  const router = useRouter();
  const steps = useMemo(() => stepsForMode(mode), [mode]);
  const [currentStep, setCurrentStep] = useState<OnboardingStepId>(
    steps.includes(initialStep) ? initialStep : steps[0]
  );
  const [animKey, setAnimKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attemptedContinue, setAttemptedContinue] = useState(false);

  const [companyName, setCompanyName] = useState(initialProgress.company?.name ?? "");
  const [industry, setIndustry] = useState(initialProgress.company?.industry ?? "");
  const [businessType, setBusinessType] = useState<"trades" | "real_estate">(
    initialProgress.company?.businessType === "real_estate" ? "real_estate" : "trades"
  );
  const [country, setCountry] = useState<OnboardingCountryCode>(
    initialProgress.company?.country ?? "ZW"
  );
  const [website, setWebsite] = useState(initialProgress.company?.website ?? "");
  const [slug, setSlug] = useState(initialProgress.company?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialProgress.company?.slug));
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const [ownerName, setOwnerName] = useState(initialProgress.account?.ownerName ?? "");
  const [phone, setPhone] = useState(initialProgress.account?.phone ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [logoUrl, setLogoUrl] = useState<string | null>(initialProgress.branding?.logoUrl ?? null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialProgress.branding?.logoUrl ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [teamMembers, setTeamMembers] = useState(
    initialProgress.team?.length
      ? initialProgress.team
      : [{ name: "", email: "", phone: "" }]
  );

  const stepIndex = steps.indexOf(currentStep);

  useEffect(() => {
    if (!slugTouched && companyName) {
      setSlug(suggestSlugFromName(companyName));
    }
  }, [companyName, slugTouched]);

  const cloudDomain =
    process.env.NEXT_PUBLIC_CLOUD_DOMAIN?.replace(/^https?:\/\//, "") ?? "cloud.segmiq.com";

  const checkSlug = useCallback(
    async (value: string) => {
      const norm = value.trim().toLowerCase();
      if (!norm || !/^[a-z0-9-]+$/.test(norm)) {
        setSlugAvailable(null);
        return;
      }
      setCheckingSlug(true);
      try {
        const res = await fetch(
          `/api/onboard/check-slug?slug=${encodeURIComponent(norm)}&token=${encodeURIComponent(token)}`
        );
        const data = (await res.json()) as { available?: boolean };
        setSlugAvailable(res.ok ? Boolean(data.available) : false);
      } catch {
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    },
    [token]
  );

  function showError(field: string, message: string, errors: FieldErrors) {
    if (attemptedContinue || touched[field]) errors[field] = message;
  }

  function validateStep(step: OnboardingStepId): FieldErrors {
    const errors: FieldErrors = {};
    if (step === "company") {
      if (!companyName.trim()) showError("companyName", "Company name is required", errors);
      if (!industry.trim()) showError("industry", "Industry is required", errors);
      if (!country) showError("country", "Country is required", errors);
      const slugNorm = slug.trim().toLowerCase();
      if (!slugNorm) showError("slug", "URL slug is required", errors);
      else if (!/^[a-z0-9-]+$/.test(slugNorm)) showError("slug", "Lowercase letters, numbers, and hyphens only", errors);
      else if (slugAvailable === false) showError("slug", "This slug is already taken", errors);
    }
    if (step === "account") {
      if (!ownerName.trim()) showError("ownerName", "Your name is required", errors);
      if (mode === "solo" && !phone.trim()) showError("phone", "WhatsApp number is required", errors);
      if (password.length < 8) showError("password", "Password must be at least 8 characters", errors);
      if (password !== confirmPassword) showError("confirmPassword", "Passwords do not match", errors);
    }
    if (step === "team" && mode === "team") {
      teamMembers.forEach((m, i) => {
        const hasAny = m.name.trim() || m.email.trim() || m.phone.trim();
        if (!hasAny) return;
        if (!m.name.trim()) showError(`team.${i}.name`, "Name is required", errors);
        if (!m.email.trim()) showError(`team.${i}.email`, "Email is required", errors);
        if (!m.phone.trim()) showError(`team.${i}.phone`, "Phone is required", errors);
      });
    }
    return errors;
  }

  const stepValid = Object.keys(validateStep(currentStep)).length === 0;

  async function persistStep(
    step: OnboardingStepId,
    overrides?: Partial<{ logoUrl: string | null }>
  ): Promise<boolean> {
    const payload: { step: OnboardingStepId; data: Record<string, unknown> } = { step, data: {} };
    if (step === "company") {
      payload.data = {
        name: companyName.trim(),
        industry: industry.trim(),
        country,
        website: website.trim() || undefined,
        slug: slug.trim().toLowerCase(),
        businessType,
      };
    } else if (step === "account") {
      payload.data = { ownerName: ownerName.trim(), phone: phone.trim() || undefined };
    } else if (step === "branding") {
      payload.data = { logoUrl: overrides?.logoUrl !== undefined ? overrides.logoUrl : logoUrl };
    } else if (step === "team") {
      payload.data = {
        team: teamMembers
          .filter((m) => m.name.trim() || m.email.trim() || m.phone.trim())
          .map((m) => ({
            name: m.name.trim(),
            email: m.email.trim(),
            phone: m.phone.trim(),
          })),
      };
    }

    const res = await fetch(`/api/onboard/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setApiError(j.error ?? "Failed to save progress");
      return false;
    }
    return true;
  }

  async function handleContinue() {
    setAttemptedContinue(true);
    setApiError("");
    const errors = validateStep(currentStep);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const ok = await persistStep(currentStep);
      if (!ok) return;
      const nextIdx = stepIndex + 1;
      if (nextIdx < steps.length) {
        setCurrentStep(steps[nextIdx]);
        setAnimKey((k) => k + 1);
        setAttemptedContinue(false);
        setFieldErrors({});
        setTouched({});
      }
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (stepIndex <= 0) return;
    setCurrentStep(steps[stepIndex - 1]);
    setAnimKey((k) => k + 1);
    setAttemptedContinue(false);
    setFieldErrors({});
    setApiError("");
  }

  async function handleLogoUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setFieldErrors((e) => ({ ...e, logo: "Image must be under 10MB" }));
      return;
    }
    setUploadingLogo(true);
    setFieldErrors((e) => {
      const next = { ...e };
      delete next.logo;
      return next;
    });
    try {
      const form = new FormData();
      form.append("token", token);
      form.append("file", file);

      const uploadRes = await fetch("/api/onboard/upload", {
        method: "POST",
        body: form,
      });
      const payload = (await uploadRes.json().catch(() => ({}))) as {
        publicUrl?: string;
        error?: string;
      };
      if (!uploadRes.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }
      if (!payload.publicUrl) {
        throw new Error("Upload succeeded but no URL returned");
      }

      setLogoUrl(payload.publicUrl);
      setLogoPreview(URL.createObjectURL(file));
      const saved = await persistStep("branding", { logoUrl: payload.publicUrl });
      if (!saved) {
        throw new Error("Uploaded but could not save progress");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setFieldErrors((e) => ({
        ...e,
        logo: message === "Upload failed" ? "Upload failed. Please try again." : message,
      }));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleFinish() {
    setAttemptedContinue(true);
    setApiError("");
    const errors = validateStep("review");
    for (const s of steps) {
      if (s === "review") continue;
      Object.assign(errors, validateStep(s));
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstBad = steps.find((s) => Object.keys(validateStep(s)).length > 0);
      if (firstBad) setCurrentStep(firstBad);
      return;
    }

    setFinishing(true);
    try {
      for (const s of steps) {
        if (s !== "review") {
          const ok = await persistStep(s);
          if (!ok) return;
        }
      }

      const res = await fetch(`/api/onboard/${token}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string; email?: string; mode?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Failed to complete setup");
        return;
      }

      const signInRes = await signIn("credentials", {
        email: data.email ?? ownerEmail,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setApiError("Account created, but sign-in failed. Please log in manually.");
        return;
      }

      router.push(mode === "solo" ? "/solo/dashboard" : "/client/dashboard");
    } finally {
      setFinishing(false);
    }
  }

  function onFormKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && currentStep !== "review") {
      e.preventDefault();
      if (stepValid && !saving) void handleContinue();
    }
  }

  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [currentStep, animKey]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Mobile progress */}
      <div className="border-b border-[var(--border)] px-4 py-4 sm:hidden">
        <p className="mb-3 text-[15px] font-semibold text-[var(--accent)]">Segmiq</p>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < stepIndex ? "bg-[var(--accent)]" : i === stepIndex ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              }`}
              style={i === stepIndex ? { opacity: 0.5 } : undefined}
            />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
          Step {stepIndex + 1} of {steps.length} — {STEP_LABELS[currentStep]}
        </p>
      </div>

      <div className="mx-auto flex max-w-[900px] gap-0 px-4 py-8 sm:gap-12 sm:px-8 sm:py-12 lg:gap-16">
        {/* Left rail stepper */}
        <aside className="sticky top-8 hidden h-fit w-[240px] shrink-0 self-start sm:block">
          <p className="mb-10 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">Segmiq</p>
          <nav aria-label="Onboarding steps">
            {steps.map((s, i) => {
              const done = i < stepIndex;
              const active = s === currentStep;
              return (
                <div key={s} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${
                        active
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : done
                            ? "border border-[var(--accent)] bg-transparent text-[var(--accent)]"
                            : "border border-[var(--border)] bg-transparent text-[var(--text-tertiary)]"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
                    </div>
                    {i < steps.length - 1 ? (
                      <div className="my-1 w-px flex-1 min-h-[20px] bg-[var(--border)]" />
                    ) : null}
                  </div>
                  <div className={`pb-6 pt-0.5 ${i === steps.length - 1 ? "pb-0" : ""}`}>
                    <span
                      className={`text-[13px] font-medium ${
                        active
                          ? "text-[var(--text-primary)]"
                          : done
                            ? "text-[var(--text-secondary)]"
                            : "text-[var(--text-tertiary)]"
                      }`}
                    >
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Form column */}
        <div className="w-full max-w-[440px] flex-1">
          <div
            key={animKey}
            className="onboard-step-enter"
            onKeyDown={onFormKeyDown}
          >
            <h1
              className="mb-2 text-[28px] leading-tight text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-instrument-serif), 'Instrument Serif', serif" }}
            >
              {STEP_HEADINGS[currentStep]}
            </h1>
            <p className="mb-8 text-[14px] text-[var(--text-secondary)]">
              {currentStep === "company" && "Tell us about your business."}
              {currentStep === "account" && "Create the account you'll use to sign in."}
              {currentStep === "branding" && "Optional — you can enable watermarking later."}
              {currentStep === "team" && "Each person will receive their own invite email."}
              {currentStep === "review" && "Confirm everything looks right, then finish."}
            </p>

            {currentStep === "company" && (
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Company name</label>
                  <input
                    ref={(el) => { firstFieldRef.current = el; }}
                    className={inputClass}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, companyName: true }))}
                  />
                  {(attemptedContinue || touched.companyName) && fieldErrors.companyName ? (
                    <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors.companyName}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass}>Industry</label>
                  <input
                    className={inputClass}
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, industry: true }))}
                    placeholder="e.g. Solar, HVAC"
                  />
                  {(attemptedContinue || touched.industry) && fieldErrors.industry ? (
                    <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors.industry}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass}>Business type</label>
                  <select
                    className={inputClass}
                    value={businessType}
                    onChange={(e) =>
                      setBusinessType(e.target.value === "real_estate" ? "real_estate" : "trades")
                    }
                  >
                    <option value="trades">Trade / Service Business</option>
                    <option value="real_estate">Real Estate Agency</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <select
                    className={inputClass}
                    value={country}
                    onChange={(e) => setCountry(e.target.value as OnboardingCountryCode)}
                  >
                    {ONBOARDING_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    Website <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
                  </label>
                  <input
                    className={inputClass}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://"
                  />
                </div>
                <div>
                  <label className={labelClass}>URL slug</label>
                  <input
                    className={`${inputClass} font-mono`}
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase());
                      setSlugAvailable(null);
                    }}
                    onBlur={() => {
                      setTouched((t) => ({ ...t, slug: true }));
                      void checkSlug(slug);
                    }}
                  />
                  <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">
                    {cloudDomain}/<span className="text-[var(--accent)]">{slug || "your-slug"}</span>
                    {checkingSlug ? " · checking…" : slugAvailable === true ? " · available" : slugAvailable === false ? " · taken" : ""}
                  </p>
                  {(attemptedContinue || touched.slug) && fieldErrors.slug ? (
                    <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors.slug}</p>
                  ) : null}
                </div>
              </div>
            )}

            {currentStep === "account" && (
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Your name</label>
                  <input
                    ref={(el) => { firstFieldRef.current = el; }}
                    className={inputClass}
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, ownerName: true }))}
                  />
                  {(attemptedContinue || touched.ownerName) && fieldErrors.ownerName ? (
                    <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors.ownerName}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input className={`${inputClass} opacity-70`} value={ownerEmail} readOnly tabIndex={-1} />
                </div>
                <div>
                  <label className={labelClass}>
                    WhatsApp number{" "}
                    {mode === "solo" ? "" : <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>}
                  </label>
                  <input
                    className={inputClass}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    placeholder="+263 77 123 4567"
                  />
                  {(attemptedContinue || touched.phone) && fieldErrors.phone ? (
                    <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors.phone}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    className={inputClass}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    autoComplete="new-password"
                  />
                  {(attemptedContinue || touched.password) && fieldErrors.password ? (
                    <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors.password}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass}>Confirm password</label>
                  <input
                    className={inputClass}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                    autoComplete="new-password"
                  />
                  {(attemptedContinue || touched.confirmPassword) && fieldErrors.confirmPassword ? (
                    <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors.confirmPassword}</p>
                  ) : null}
                </div>
              </div>
            )}

            {currentStep === "branding" && (
              <div className="space-y-5">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                  }}
                />
                <button
                  type="button"
                  ref={(el) => { if (currentStep === "branding") firstFieldRef.current = el as unknown as HTMLInputElement; }}
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--surface-input)] px-6 py-10 transition-colors hover:border-[var(--border-hover)]"
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Logo preview" className="max-h-24 max-w-full object-contain" />
                  ) : (
                    <Upload className="h-8 w-8 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                  )}
                  <span className="text-[14px] text-[var(--text-secondary)]">
                    {uploadingLogo ? "Uploading…" : logoPreview ? "Change logo" : "Upload logo"}
                  </span>
                </button>
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  JPEG, PNG, or WEBP up to 10 MB. Watermarking can be enabled later in settings.
                </p>
                {fieldErrors.logo ? (
                  <p className="text-[13px] text-[var(--error)]">{fieldErrors.logo}</p>
                ) : null}
              </div>
            )}

            {currentStep === "team" && mode === "team" && (
              <div className="space-y-6">
                {teamMembers.map((member, i) => (
                  <div key={i} className="space-y-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                        Salesperson {i + 1}
                      </span>
                      {teamMembers.length > 1 ? (
                        <button
                          type="button"
                          className="text-[var(--text-tertiary)] hover:text-[var(--error)]"
                          onClick={() => setTeamMembers((m) => m.filter((_, j) => j !== i))}
                          aria-label="Remove salesperson"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>Name</label>
                      <input
                        ref={i === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
                        className={inputClass}
                        value={member.name}
                        onChange={(e) =>
                          setTeamMembers((m) => m.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)))
                        }
                      />
                      {fieldErrors[`team.${i}.name`] ? (
                        <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors[`team.${i}.name`]}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>Email</label>
                      <input
                        className={inputClass}
                        type="email"
                        value={member.email}
                        onChange={(e) =>
                          setTeamMembers((m) => m.map((row, j) => (j === i ? { ...row, email: e.target.value } : row)))
                        }
                      />
                      {fieldErrors[`team.${i}.email`] ? (
                        <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors[`team.${i}.email`]}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input
                        className={inputClass}
                        type="tel"
                        value={member.phone}
                        onChange={(e) =>
                          setTeamMembers((m) => m.map((row, j) => (j === i ? { ...row, phone: e.target.value } : row)))
                        }
                        placeholder="+263 77 123 4567"
                      />
                      {fieldErrors[`team.${i}.phone`] ? (
                        <p className="mt-1.5 text-[13px] text-[var(--error)]">{fieldErrors[`team.${i}.phone`]}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setTeamMembers((m) => [...m, { name: "", email: "", phone: "" }])}
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  Add another salesperson
                </button>
              </div>
            )}

            {currentStep === "review" && (
              <div className="space-y-4 rounded-[10px] border border-[var(--border)] bg-[var(--bg-secondary)] p-5 text-[14px]">
                <ReviewRow label="Company" value={companyName} />
                <ReviewRow label="Industry" value={industry} />
                <ReviewRow
                  label="Business type"
                  value={businessType === "real_estate" ? "Real Estate Agency" : "Trade / Service Business"}
                />
                <ReviewRow label="Country" value={ONBOARDING_COUNTRIES.find((c) => c.code === country)?.label ?? country} />
                {website ? <ReviewRow label="Website" value={website} /> : null}
                <ReviewRow label="Slug" value={`${cloudDomain}/${slug}`} accent />
                <ReviewRow label="Account" value={`${ownerName} · ${ownerEmail}`} />
                {phone ? <ReviewRow label="WhatsApp" value={phone} /> : null}
                <ReviewRow label="Logo" value={logoUrl ? "Uploaded" : "None"} />
                {mode === "team" && teamMembers.filter((m) => m.name).length > 0 ? (
                  <div>
                    <p className="mb-1 text-[12px] text-[var(--text-tertiary)]">Sales team</p>
                    <ul className="space-y-1 text-[var(--text-primary)]">
                      {teamMembers
                        .filter((m) => m.name.trim())
                        .map((m, i) => (
                          <li key={i}>
                            {m.name} — {m.email}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}

            {apiError ? <p className="mt-4 text-[13px] text-[var(--error)]">{apiError}</p> : null}

            <div className="mt-10 flex gap-3">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={saving || finishing}
                  className="inline-flex h-[42px] flex-1 items-center justify-center rounded-[10px] border border-[var(--border)] bg-transparent text-[14px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] disabled:opacity-50 sm:flex-none sm:px-6"
                >
                  Back
                </button>
              ) : null}
              {currentStep === "review" ? (
                <button
                  type="button"
                  onClick={() => void handleFinish()}
                  disabled={finishing}
                  className="inline-flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] text-[14px] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60 sm:min-w-[140px]"
                >
                  {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {finishing ? "Finishing…" : "Finish"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleContinue()}
                  disabled={saving}
                  className="inline-flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] text-[14px] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60 sm:min-w-[140px]"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Saving…" : "Continue"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function ReviewRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
      <span className="text-[12px] text-[var(--text-tertiary)]">{label}</span>
      <span className={accent ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}>{value}</span>
    </div>
  );
}
