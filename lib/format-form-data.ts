import { extractFromFormData } from "@/lib/lead-helpers";

export function formatFormKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\(.*?\)/g, '')
    .trim()
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\?$/, '?')
    .trim();
}

export function formatFormValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value
      .map(v => formatSingleValue(v))
      .join(', ');
  }
  return formatSingleValue(value);
}

function formatSingleValue(value: string): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/—/g, "—")
    .trim()
    .replace(/^\w/, (l) => l.toUpperCase());
}

/** Human-readable subject for prospect confirmation WhatsApp (template {{3}}). */
export function prospectEnquiryLabel(params: {
  project_type?: string | null;
  form_data?: Record<string, unknown> | null;
  requestedPackageName?: string | null;
}): string {
  if (params.requestedPackageName?.trim()) {
    return params.requestedPackageName.trim();
  }

  const projectType = params.project_type?.trim();
  if (projectType) return formatFormValue(projectType);

  const fd = params.form_data ?? {};
  const service = extractServiceAnswer(fd);
  if (service) return formatFormValue(service);

  const notes = extractFromFormData(fd, ["notes", "description", "message", "details", "tell us"]);
  if (notes?.trim()) {
    const formatted = formatFormValue(notes.trim());
    return formatted.length <= 60 ? formatted : `${formatted.slice(0, 57)}...`;
  }

  return "your project";
}

function isContactOrBudgetField(key: string): boolean {
  const lower = key.toLowerCase();
  return [
    "budget",
    "price",
    "value",
    "name",
    "phone",
    "email",
    "mobile",
    "tel",
    "utm_",
    "timeline",
    "when",
    "date",
    "city",
    "suburb",
    "location",
    "address",
    "zip",
    "postal",
  ].some((part) => lower.includes(part));
}

function extractServiceAnswer(formData: Record<string, unknown>): string | null {
  const labels = [
    "project type",
    "project",
    "service",
    "installation",
    "system",
    "interested",
    "looking for",
    "what do you need",
    "enquiry",
    "inquiry",
    "type of",
  ];

  for (const label of labels) {
    for (const [key, val] of Object.entries(formData)) {
      if (isContactOrBudgetField(key)) continue;
      if (!key.toLowerCase().includes(label)) continue;
      if (val != null && String(val).trim()) return String(val);
    }
  }

  return null;
}

export function formatFormData(
  formData: Record<string, unknown>
): Array<{ label: string; value: string }> {
  if (!formData) return [];

  return Object.entries(formData)
    .filter(([key, value]) => {
      if (!value) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      const skip = ['utm_source', 'utm_medium', 'utm_campaign', 'id', 'created_time'];
      return !skip.includes(key);
    })
    .map(([key, value]) => ({
      label: formatFormKey(key),
      value: formatFormValue(value as string | string[]),
    }));
}
