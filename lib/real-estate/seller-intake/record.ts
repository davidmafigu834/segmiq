import {
  fieldCopy,
  fieldsInSection,
  formatDisplayDate,
  isFieldVisible,
  sectionCopy,
  type ClientField,
  type SectionId,
} from "@/lib/real-estate/seller-intake/client-form";
import { fieldsForKind, registeredOwnerName, type IntakeField, type IntakeKind } from "@/lib/real-estate/seller-intake/fields";

const HIDDEN = "Submitted for a permitted reviewer";
const SECTION_ORDER: Array<Exclude<SectionId, "review">> = ["ownership", "property", "details", "checks", "instructions"];

export type SellerRecordRow = { key: string; label: string; value: string };
export type SellerRecordSection = { id: Exclude<SectionId, "review">; title: string; rows: SellerRecordRow[] };

export type SellerRecord = {
  agencyName: string;
  brandColor: string;
  logoUrl: string | null;
  website: string | null;
  phone: string | null;
  kindLabel: string;
  templateTitle: string | null;
  submittedLabel: string | null;
  sellerName: string;
  propertyAddress: string | null;
  sections: SellerRecordSection[];
  restrictedNote: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function brandColorOrDefault(value: string | null | undefined): string {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value.trim()) ? value.trim() : "#16342A";
}

/** Light bars need dark type. Dark bars need white type. */
export function brandInk(hex: string): "dark" | "light" {
  const color = brandColorOrDefault(hex);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "dark" : "light";
}

export function sellerRecordFilename(sellerName: string): string {
  const base = sellerName.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${base || "seller"}-mandate.pdf`;
}

function formatMoney(value: string): string {
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return value.trim();
  const [whole, fraction] = cleaned.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function displayValue(field: IntakeField, value: string): string {
  if (field.input === "date") return formatDisplayDate(value) ?? value.trim();
  if (field.input === "money") return formatMoney(value);
  return value.trim();
}

function submittedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function websiteLabel(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!/^https?:\/\//.test(text)) return null;
  return text.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function buildSellerRecord(input: {
  kind: IntakeKind;
  answers: Record<string, string>;
  restrictedPending?: boolean;
  templateTitle?: string | null;
  submittedAt?: string | null;
  agencyName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  website?: string | null;
  phone?: string | null;
}): SellerRecord {
  const present = new Set(fieldsForKind(input.kind).map((field) => field.key));
  const visibleAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.answers)) {
    const text = value.trim();
    if (!text || text === HIDDEN || !present.has(key)) continue;
    if (!isFieldVisible(key, input.answers, present)) continue;
    visibleAnswers[key] = text;
  }
  const clientFields: ClientField[] = fieldsForKind(input.kind).map((field) => ({
    key: field.key,
    input: field.input,
    options: field.options,
    requiredToSubmit: field.requiredToSubmit,
    value: visibleAnswers[field.key] ?? "",
    locked: false,
    instruction: null,
  }));
  const byKey = new Map(fieldsForKind(input.kind).map((field) => [field.key, field]));
  const sections: SellerRecordSection[] = [];
  for (const id of SECTION_ORDER) {
    const rows = fieldsInSection(id, clientFields, visibleAnswers)
      .filter((field) => field.value.trim())
      .map((field) => {
        const source = byKey.get(field.key);
        return {
          key: field.key,
          label: fieldCopy(field.key, visibleAnswers).label,
          value: source ? displayValue(source, field.value) : field.value.trim(),
        };
      });
    if (rows.length === 0) continue;
    sections.push({ id, title: sectionCopy(id, visibleAnswers).title, rows });
  }

  return {
    agencyName: input.agencyName.trim() || "Agency",
    brandColor: brandColorOrDefault(input.brandColor),
    logoUrl: input.logoUrl?.startsWith("https://") ? input.logoUrl : null,
    website: websiteLabel(input.website),
    phone: input.phone?.trim() || null,
    kindLabel: input.kind === "sole" ? "Sole mandate" : "Open mandate",
    templateTitle: input.templateTitle?.trim() || null,
    submittedLabel: submittedLabel(input.submittedAt ?? null),
    sellerName: registeredOwnerName(visibleAnswers),
    propertyAddress: visibleAnswers.propertyAddress?.trim() || null,
    sections,
    restrictedNote: input.restrictedPending
      ? "Some identity, work and source-of-funds answers were submitted. They are available to a permitted reviewer."
      : null,
  };
}
