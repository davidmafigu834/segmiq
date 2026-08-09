/** Best-effort location from lead form_data (no leads.location column). */
export function locationFromFormData(
  formData: Record<string, unknown> | null | undefined
): string | null {
  if (!formData) return null;
  for (const key of Object.keys(formData)) {
    if (/location|city|area|region|state/i.test(key)) {
      const v = formData[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}
