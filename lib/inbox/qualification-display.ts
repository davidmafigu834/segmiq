export type QualificationDisplayField = {
  label: string;
  value: string;
};

const QUAL_FIELD_LABELS: Record<string, string> = {
  project_type: "Project type",
  location: "Location",
  property_type: "Property type",
  timeline: "Timeline",
  budget: "Budget",
};

const SKIP_FORM_KEYS = new Set([
  "_qualification",
  "_instantFormId",
  "_instantFormName",
  "channel",
  "first_message",
  "name",
  "phone",
  "email",
]);

export function extractQualificationDisplayFields(
  formData: Record<string, unknown> | null | undefined
): QualificationDisplayField[] {
  if (!formData) return [];

  const fields: QualificationDisplayField[] = [];
  const seenValues = new Set<string>();

  for (const [key, label] of Object.entries(QUAL_FIELD_LABELS)) {
    const v = formData[key];
    if (typeof v === "string" && v.trim()) {
      const value = v.trim();
      fields.push({ label, value });
      seenValues.add(value.toLowerCase());
    }
  }

  for (const [key, val] of Object.entries(formData)) {
    if (SKIP_FORM_KEYS.has(key) || key.startsWith("_")) continue;
    if (QUAL_FIELD_LABELS[key]) continue;
    if (typeof val !== "string" || !val.trim()) continue;
    const value = val.trim();
    if (seenValues.has(value.toLowerCase())) continue;
    fields.push({ label: key, value });
    seenValues.add(value.toLowerCase());
  }

  return fields;
}
