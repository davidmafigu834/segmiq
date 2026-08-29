export const ONBOARDING_TOKEN_TTL_DAYS = 7;
export const ONBOARDING_TOKEN_RENEW_COOLDOWN_MS = 10 * 60 * 1000;

export const ONBOARDING_COUNTRIES = [
  { code: "ZW", label: "Zimbabwe", dialCode: "263" },
  { code: "ZM", label: "Zambia", dialCode: "260" },
  { code: "ZA", label: "South Africa", dialCode: "27" },
  { code: "KE", label: "Kenya", dialCode: "254" },
] as const;

export type OnboardingCountryCode = (typeof ONBOARDING_COUNTRIES)[number]["code"];

export const CRM_PLANS = ["starter", "professional", "business"] as const;
export type CrmClientPlan = (typeof CRM_PLANS)[number];

export type OnboardingStepId = "company" | "account" | "branding" | "team" | "review";

export function stepsForMode(mode: "team" | "solo"): OnboardingStepId[] {
  if (mode === "solo") return ["company", "account", "branding", "review"];
  return ["company", "account", "branding", "team", "review"];
}

export type OnboardingProgress = {
  step?: OnboardingStepId;
  company?: {
    name?: string;
    industry?: string;
    country?: OnboardingCountryCode;
    website?: string;
    slug?: string;
    businessType?: "trades" | "real_estate";
  };
  account?: {
    ownerName?: string;
    phone?: string;
  };
  branding?: {
    logoUrl?: string | null;
  };
  team?: Array<{
    name: string;
    email: string;
    phone: string;
  }>;
};

export function dialCodeForCountry(country: OnboardingCountryCode): string {
  return ONBOARDING_COUNTRIES.find((c) => c.code === country)?.dialCode ?? "263";
}
