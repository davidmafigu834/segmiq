import type {
  QuoteDocumentMetric,
  QuoteDocumentPayment,
  QuoteDocumentWarranty,
} from "./types";

export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatMetricNumber(n: number, digits = 1): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

const SITE_MAP: Array<[string, string]> = [
  ["site_address", "Installation address"],
  ["property_type", "Property type"],
  ["roof_type", "Roof type"],
  ["roof_area", "Roof area"],
  ["roof_orientation", "Orientation"],
  ["roof_tilt", "Tilt"],
  ["shade_level", "Shade"],
  ["net_metering", "Net metering"],
];

export function siteRows(fields: Record<string, unknown>, show: boolean): Array<{ label: string; value: string }> {
  if (!show) return [];
  return SITE_MAP.map(([key, label]) => {
    const value = str(fields[key]);
    return value ? { label, value } : null;
  }).filter((row): row is { label: string; value: string } => Boolean(row));
}

/** Display only values that were actually entered. Never invent generation/PR/CO₂. */
export function solarMetrics(fields: Record<string, unknown>, show: boolean): QuoteDocumentMetric[] {
  if (!show) return [];
  const metrics: QuoteDocumentMetric[] = [];
  const size = num(fields.system_size_kwp);
  if (size != null) {
    metrics.push({
      id: "size",
      label: "System Size",
      value: `${formatMetricNumber(size)} kWp`,
      secondary: "DC Capacity",
    });
  }
  const month = num(fields.generation_kwh_month);
  const year = num(fields.generation_kwh_year);
  if (month != null || year != null) {
    metrics.push({
      id: "gen",
      label: "Expected Generation",
      value: month != null ? `${formatMetricNumber(month, 0)} kWh/month` : `${formatMetricNumber(year!, 0)} kWh/year`,
      secondary: year != null && month != null ? `${formatMetricNumber(year, 0)} kWh/year` : null,
    });
  }
  const pr = num(fields.performance_ratio);
  if (pr != null) {
    metrics.push({
      id: "pr",
      label: "Performance Ratio",
      value: `${formatMetricNumber(pr, 0)}%`,
      secondary: "Estimated",
    });
  }
  const co2 = num(fields.co2_offset_tonnes_year);
  if (co2 != null) {
    metrics.push({
      id: "co2",
      label: "CO₂ Offset",
      value: `${formatMetricNumber(co2)} t/year`,
      secondary: "Estimated",
    });
  }
  return metrics;
}

export function paymentsFromQuote(quote: Record<string, unknown>): QuoteDocumentPayment[] {
  const schedule = Array.isArray(quote.payment_schedule) ? quote.payment_schedule : [];
  const structured = schedule
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const label = str(r.label) ?? str(r.name);
      if (!label) return null;
      const percent = num(r.percent) ?? num(r.percentage);
      const amount = num(r.amount);
      const trigger = str(r.trigger) ?? str(r.timing) ?? str(r.condition);
      const amountLabel =
        percent != null ? `${percent}%` : amount != null ? String(amount) : null;
      return { label, detail: trigger, amountLabel } as QuoteDocumentPayment;
    })
    .filter((row): row is QuoteDocumentPayment => row != null);
  if (structured.length) return structured;
  const label = str(quote.payment_terms_label);
  return label ? [{ label, detail: null, amountLabel: null }] : [];
}

const WARRANTY_FIELD_MAP: Array<[string, string]> = [
  ["warranty_pv_modules", "PV Modules"],
  ["warranty_inverter", "Inverter"],
  ["warranty_battery", "Battery"],
  ["warranty_workmanship", "Workmanship"],
  ["warranty_support", "Support"],
];

export function warrantyFromQuote(
  quote: Record<string, unknown>,
  fields: Record<string, unknown>,
  show: boolean
): QuoteDocumentWarranty[] {
  if (!show) return [];
  const structured = Array.isArray(fields.warranty_items) ? fields.warranty_items : [];
  const fromItems = structured
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const label = str(r.label);
      const detail = str(r.period) ?? str(r.detail);
      return label && detail ? { label, detail } : null;
    })
    .filter((row): row is QuoteDocumentWarranty => Boolean(row));
  if (fromItems.length) return fromItems;
  const fromKeys = WARRANTY_FIELD_MAP.map(([key, label]) => {
    const detail = str(fields[key]);
    return detail ? { label, detail } : null;
  }).filter((row): row is QuoteDocumentWarranty => Boolean(row));
  if (fromKeys.length) return fromKeys;
  const note = str(quote.warranty_terms);
  return note ? [{ label: "Warranty", detail: note }] : [];
}

export function defaultSummary(
  fields: Record<string, unknown>,
  dealName: string | null,
  size: number | null
): string {
  const explicit = str(fields.project_summary);
  if (explicit) return explicit.length > 420 ? `${explicit.slice(0, 417).trimEnd()}…` : explicit;
  if (dealName && size != null) {
    return `Design, supply, installation and commissioning of a ${formatMetricNumber(size)} kWp residential solar system for this property, as specified in the equipment schedule.`;
  }
  if (dealName) return dealName.length > 420 ? `${dealName.slice(0, 417).trimEnd()}…` : dealName;
  return "Design, supply, installation and commissioning of a residential solar solution as specified in this quotation.";
}

export function brandModelFromItem(name: string, sku: string | null, description: string | null): string | null {
  const model = str(sku);
  if (!model) return null;
  if (model.toLowerCase() === name.trim().toLowerCase()) return null;
  if (description && model.toLowerCase() === description.toLowerCase()) return null;
  return model;
}

export function recommendSolarTemplate(dealName: string | null | undefined, serviceSummary?: string | null): boolean {
  const hay = `${dealName ?? ""} ${serviceSummary ?? ""}`.toLowerCase();
  return /\b(solar|pv|photovolta|rooftop|inverter|battery storage|kWp)\b/i.test(hay);
}

export function splitHeroLines(headline: string): string[] {
  const lines = headline
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : [headline];
}

export function signatoryParts(company: {
  name: string;
  signatoryName: string | null;
  signatoryRole: string | null;
}): { name: string; role: string | null; company: string } {
  const companyName = company.name.trim();
  const person = company.signatoryName?.trim() || null;
  const role = company.signatoryRole?.trim() || null;
  const personIsCompany = person && person.toLowerCase() === companyName.toLowerCase();
  const roleIsCompany = role && role.toLowerCase() === companyName.toLowerCase();
  return {
    name: person && !personIsCompany ? person : "Authorised Signatory",
    role: role && !roleIsCompany ? role : null,
    company: companyName,
  };
}

export const TERMS_PAGE_THRESHOLD = 240;

export function termsNeedOwnPage(terms: string | null): boolean {
  if (!terms) return false;
  return terms.length > TERMS_PAGE_THRESHOLD || terms.split(/\n/).filter(Boolean).length > 4;
}
