import {
  RESIDENTIAL_PREMIUM_SOLAR_KEY,
  RESIDENTIAL_PREMIUM_SOLAR_VERSION,
  TEMPLATE_LIME,
  type BuiltinTemplateDefinition,
  type TemplateFieldDef,
  type TemplatePresentation,
} from "./types";

export const SOLAR_FIELD_SCHEMA: TemplateFieldDef[] = [
  { key: "site_address", label: "Installation address", group: "site", kind: "text", optional: true },
  {
    key: "property_type",
    label: "Property type",
    group: "site",
    kind: "select",
    optional: true,
    options: ["Residential", "Townhouse", "Farm", "Other"],
  },
  { key: "roof_type", label: "Roof type", group: "site", kind: "text", optional: true },
  { key: "roof_area", label: "Roof area", group: "site", kind: "text", optional: true },
  { key: "roof_orientation", label: "Orientation", group: "site", kind: "text", optional: true },
  { key: "roof_tilt", label: "Tilt", group: "site", kind: "text", optional: true },
  { key: "shade_level", label: "Shade", group: "site", kind: "text", optional: true },
  { key: "net_metering", label: "Net metering", group: "site", kind: "text", optional: true },
  { key: "system_size_kwp", label: "System size", group: "performance", kind: "number", optional: true, unit: "kWp" },
  {
    key: "generation_kwh_month",
    label: "Expected generation (month)",
    group: "performance",
    kind: "number",
    optional: true,
    unit: "kWh/month",
  },
  {
    key: "generation_kwh_year",
    label: "Expected generation (year)",
    group: "performance",
    kind: "number",
    optional: true,
    unit: "kWh/year",
  },
  {
    key: "performance_ratio",
    label: "Performance ratio",
    group: "performance",
    kind: "number",
    optional: true,
    unit: "%",
  },
  {
    key: "co2_offset_tonnes_year",
    label: "CO₂ offset",
    group: "performance",
    kind: "number",
    optional: true,
    unit: "t/year",
  },
  { key: "warranty_pv_modules", label: "PV modules warranty", group: "copy", kind: "text", optional: true },
  { key: "warranty_inverter", label: "Inverter warranty", group: "copy", kind: "text", optional: true },
  { key: "warranty_battery", label: "Battery warranty", group: "copy", kind: "text", optional: true },
  { key: "warranty_workmanship", label: "Workmanship warranty", group: "copy", kind: "text", optional: true },
];

export const RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS: TemplatePresentation = {
  badge: "RESIDENTIAL PREMIUM",
  showBadge: true,
  heroHeadline: "Powering\nSmarter Homes.\nSustainably.",
  heroSubcopy: "High-performance solar solutions built for your home and future.",
  heroAccentWord: "Smarter Homes.",
  heroImageUrl: null,
  showSite: true,
  showSummary: true,
  showMetrics: true,
  showWarranty: true,
  showAcceptance: true,
  showAmountInWords: true,
  showPoweredBy: false,
  accent: TEMPLATE_LIME,
};

export const BUILTIN_TEMPLATES: BuiltinTemplateDefinition[] = [
  {
    key: RESIDENTIAL_PREMIUM_SOLAR_KEY,
    name: "Residential Premium Solar",
    category: "Solar",
    description: "Premium visual quotation for residential rooftop solar and battery projects.",
    longDescription:
      "A premium visual quotation for residential rooftop solar installations, combining project context, system performance, equipment, payment terms and warranty.",
    layoutVersion: RESIDENTIAL_PREMIUM_SOLAR_VERSION,
    fieldSchema: SOLAR_FIELD_SCHEMA,
    defaultPresentation: RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS,
    thumbnailSrc: "/quotation-templates/residential-premium-solar/thumb.svg",
    defaultHeroSrc: "/quotation-templates/residential-premium-solar/hero.png",
  },
];

export function getBuiltinTemplate(key: string | null | undefined): BuiltinTemplateDefinition | null {
  if (!key) return null;
  return BUILTIN_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function mergePresentation(
  base: TemplatePresentation,
  override: Record<string, unknown> | null | undefined
): TemplatePresentation {
  if (!override) return { ...base };
  return {
    badge: typeof override.badge === "string" && override.badge.trim() ? override.badge : base.badge,
    showBadge: override.showBadge !== false,
    heroHeadline:
      typeof override.heroHeadline === "string" && override.heroHeadline.trim()
        ? upgradeLegacyHeadline(override.heroHeadline)
        : base.heroHeadline,
    heroSubcopy:
      typeof override.heroSubcopy === "string" && override.heroSubcopy.trim()
        ? upgradeLegacySubcopy(override.heroSubcopy)
        : base.heroSubcopy,
    heroAccentWord:
      typeof override.heroAccentWord === "string" ? override.heroAccentWord : base.heroAccentWord,
    heroImageUrl:
      typeof override.heroImageUrl === "string" && override.heroImageUrl.trim()
        ? override.heroImageUrl
        : base.heroImageUrl,
    showSite: override.showSite !== false,
    showSummary: override.showSummary !== false,
    showMetrics: override.showMetrics !== false,
    showWarranty: override.showWarranty !== false,
    showAcceptance: override.showAcceptance !== false,
    showAmountInWords: override.showAmountInWords !== false,
    showPoweredBy: override.showPoweredBy === true,
    accent: typeof override.accent === "string" && override.accent.trim() ? override.accent : base.accent,
  };
}

export function isSolarLayout(layoutKey: string | null | undefined): boolean {
  return layoutKey === RESIDENTIAL_PREMIUM_SOLAR_KEY;
}

function upgradeLegacyHeadline(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (compact === "powering smarter homes." || compact === "powering smarter homes") {
    return RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS.heroHeadline;
  }
  return value;
}

function upgradeLegacySubcopy(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (compact === "a reliable solar solution designed around your home and energy needs.") {
    return RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS.heroSubcopy;
  }
  return value;
}
