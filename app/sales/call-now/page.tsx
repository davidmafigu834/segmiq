import { redirect } from "next/navigation";

/**
 * Legacy URL for the salesperson Leads directory.
 * Canonical path is `/sales/leads`.
 */
export default function LegacyCallNowRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  redirect(qs ? `/sales/leads?${qs}` : "/sales/leads");
}
