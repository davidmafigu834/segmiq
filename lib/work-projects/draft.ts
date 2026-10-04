import { RESIDENTIAL_PREMIUM_SOLAR_KEY } from "@/lib/quotations/layouts/types";
import {
  isWorkProjectWorkflow,
  type WorkProjectWorkflow,
} from "@/lib/work-projects/constants";

const SOLAR_WORD = /\bsolar\b/i;

export function suggestWorkProjectWorkflow(input: {
  explicit?: string | null;
  templateLayoutKey?: string | null;
  projectType?: string | null;
  serviceSummary?: string | null;
  dealName?: string | null;
}): WorkProjectWorkflow {
  if (input.explicit && isWorkProjectWorkflow(input.explicit)) return input.explicit;
  if (input.templateLayoutKey === RESIDENTIAL_PREMIUM_SOLAR_KEY) return "SOLAR_INSTALLATION";
  const blob = [input.projectType, input.serviceSummary, input.dealName].filter(Boolean).join(" ");
  if (SOLAR_WORD.test(blob)) return "SOLAR_INSTALLATION";
  return "GENERAL_TRADES";
}

export function buildWorkProjectTitle(input: {
  customerName: string;
  service: string | null;
  workflow: WorkProjectWorkflow;
}): string {
  const name = input.customerName.trim() || "Customer";
  const service = input.service?.trim();
  if (service) return `${name} — ${service}`;
  if (input.workflow === "SOLAR_INSTALLATION") return `${name} — Solar Installation`;
  return `${name} — Project`;
}

export function formatWorkProjectNumber(sequence: number): string {
  const n = Math.max(1, Math.floor(sequence));
  return `PRJ-${String(n).padStart(6, "0")}`;
}

export type SolarQuoteSnapshot = {
  systemSize: string | null;
  siteAddress: string | null;
  propertyType: string | null;
  roofType: string | null;
  orientation: string | null;
  shade: string | null;
  warranty: string | null;
};

export function readSolarQuoteSnapshot(
  layoutKey: string | null | undefined,
  fields: Record<string, unknown> | null | undefined
): SolarQuoteSnapshot | null {
  if (layoutKey !== RESIDENTIAL_PREMIUM_SOLAR_KEY) return null;
  const source = fields ?? {};
  const text = (key: string) => {
    const value = source[key];
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
  };
  const size = text("system_size_kwp");
  const warranties = [
    text("warranty_pv_modules") ? `Modules: ${text("warranty_pv_modules")}` : null,
    text("warranty_inverter") ? `Inverter: ${text("warranty_inverter")}` : null,
    text("warranty_battery") ? `Battery: ${text("warranty_battery")}` : null,
    text("warranty_workmanship") ? `Workmanship: ${text("warranty_workmanship")}` : null,
  ].filter(Boolean);
  return {
    systemSize: size ? `${size} kWp` : null,
    siteAddress: text("site_address"),
    propertyType: text("property_type"),
    roofType: text("roof_type"),
    orientation: text("roof_orientation"),
    shade: text("shade_level"),
    warranty: warranties.length ? warranties.join(" · ") : null,
  };
}
