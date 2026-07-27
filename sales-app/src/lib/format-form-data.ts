export function formatFormKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\(.*?\)/g, "")
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/\?$/, "?")
    .trim();
}

export function formatFormValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((v) => formatSingleValue(v)).join(", ");
  }
  return formatSingleValue(value);
}

function formatSingleValue(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "string" ? value : String(value);
  if (!text) return "";
  return text
    .replace(/_/g, " ")
    .trim()
    .replace(/^\w/, (l) => l.toUpperCase());
}

export function formatFormData(
  formData: Record<string, unknown> | null | undefined
): Array<{ label: string; value: string }> {
  if (!formData) return [];

  return Object.entries(formData)
    .filter(([key, value]) => {
      if (key.startsWith("_")) return false; // internal metadata (e.g. _fbQualScore)
      if (value == null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      const skip = ["utm_source", "utm_medium", "utm_campaign", "id", "created_time"];
      return !skip.includes(key);
    })
    .map(([key, value]) => ({
      label: formatFormKey(key),
      value: formatFormValue(value),
    }));
}
