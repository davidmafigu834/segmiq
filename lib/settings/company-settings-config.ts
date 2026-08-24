export const SETTINGS_CATEGORIES = [
  "company",
  "profile",
  "team",
  "notifications",
  "integrations",
  "automation",
  "data",
  "security",
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export type SettingsSection = {
  id: string;
  label: string;
  icon: string;
};

export const SETTINGS_CATEGORY_LABELS: Record<SettingsCategory, string> = {
  company: "Company",
  profile: "Profile",
  team: "Team & Permissions",
  notifications: "Notifications",
  integrations: "Integrations",
  automation: "Automation",
  data: "Data",
  security: "Security",
};

export const SETTINGS_SECTIONS: Record<SettingsCategory, SettingsSection[]> = {
  company: [
    { id: "information", label: "Company Information", icon: "building" },
    { id: "branding", label: "Branding", icon: "palette" },
    { id: "business", label: "Business Details", icon: "briefcase" },
    { id: "localization", label: "Localization", icon: "globe" },
    { id: "subscription", label: "Subscription", icon: "crown" },
    { id: "preferences", label: "Preferences", icon: "sliders" },
  ],
  profile: [
    { id: "personal", label: "Personal Information", icon: "user" },
    { id: "account", label: "Account", icon: "lock" },
    { id: "appearance", label: "Appearance", icon: "sun" },
  ],
  team: [{ id: "members", label: "Team Members", icon: "users" }],
  notifications: [{ id: "alerts", label: "Sales Alerts", icon: "bell" }],
  integrations: [
    { id: "apps", label: "Connected Apps", icon: "plug" },
    { id: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
  ],
  automation: [
    { id: "assignment", label: "Lead Assignment", icon: "git" },
    { id: "agent", label: "SegmiQ Agent", icon: "bot" },
  ],
  data: [{ id: "export", label: "Export", icon: "download" }],
  security: [{ id: "authentication", label: "Authentication", icon: "shield" }],
};

export const SETTINGS_DEFAULT_SECTION: Record<SettingsCategory, string> = {
  company: "information",
  profile: "personal",
  team: "members",
  notifications: "alerts",
  integrations: "apps",
  automation: "assignment",
  data: "export",
  security: "authentication",
};

export function isSettingsCategory(value: string | undefined): value is SettingsCategory {
  return SETTINGS_CATEGORIES.includes(value as SettingsCategory);
}

export function settingsPath(category: SettingsCategory, section?: string, previewClientId?: string | null): string {
  const sec = section ?? SETTINGS_DEFAULT_SECTION[category];
  const path =
    sec === SETTINGS_DEFAULT_SECTION[category]
      ? `/client/settings/${category}`
      : `/client/settings/${category}/${sec}`;
  if (!previewClientId) return path;
  return `${path}?clientId=${encodeURIComponent(previewClientId)}`;
}

export function settingsSectionsFor(
  category: SettingsCategory,
  opts?: { realEstate?: boolean }
): SettingsSection[] {
  const base = SETTINGS_SECTIONS[category];
  if (category === "integrations" && opts?.realEstate) {
    return [...base, { id: "website", label: "Website API", icon: "plug" }];
  }
  return base;
}

export function parseSettingsSlug(
  slug: string[] | undefined,
  opts?: { realEstate?: boolean }
): {
  category: SettingsCategory;
  section: string;
} {
  const category = isSettingsCategory(slug?.[0]) ? slug![0] : "company";
  const requested = slug?.[1];
  const known = settingsSectionsFor(category, opts).some((s) => s.id === requested);
  const section = known && requested ? requested : SETTINGS_DEFAULT_SECTION[category];
  return { category, section };
}

/** Prefix https:// when the user types a bare domain. */
export function normalizeWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) return `https://${value}`;
  return value;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const INDUSTRY_OPTIONS = [
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
] as const;

export const DIAL_CODES = [
  { value: "263", label: "Zimbabwe (+263)" },
  { value: "260", label: "Zambia (+260)" },
  { value: "27", label: "South Africa (+27)" },
  { value: "254", label: "Kenya (+254)" },
] as const;

export const COMPANY_TIMEZONES = [
  { value: "Africa/Harare", label: "(GMT+2) Harare" },
  { value: "Africa/Johannesburg", label: "(GMT+2) Johannesburg" },
  { value: "Africa/Lusaka", label: "(GMT+2) Lusaka" },
  { value: "Africa/Nairobi", label: "(GMT+3) Nairobi" },
  { value: "UTC", label: "(GMT+0) UTC" },
] as const;

export const ASSIGNMENT_MODE_LABELS: Record<string, string> = {
  direct: "Direct assignment",
  pool: "Open pool",
  round_robin: "Round robin",
};
