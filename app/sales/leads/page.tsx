import { redirect } from "next/navigation";

/**
 * Legacy My Pipeline URL.
 * - `?lead=` → Leads directory (lead detail lives there now)
 * - otherwise → `/sales/pipeline` (preserve deal/stage/tab filters)
 */
export default function LegacySalesLeadsRedirect({
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

  const leadId = params.get("lead");
  if (leadId) {
    const qs = params.toString();
    redirect(qs ? `/sales/call-now?${qs}` : "/sales/call-now");
  }

  const qs = params.toString();
  redirect(qs ? `/sales/pipeline?${qs}` : "/sales/pipeline");
}
