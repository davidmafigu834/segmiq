import { createAdminClient } from "@/lib/supabase/admin";

export type LocationLeadRow = {
  id: string;
  status: string;
  form_data: Record<string, unknown> | null;
  created_at: string;
};

export type LeadLocationStat = {
  location: string;
  leads: number;
  sharePct: number;
  open: number;
  won: number;
  lost: number;
  notQualified: number;
};

export type LeadLocationAnalysis = {
  windowStart: string;
  windowEnd: string;
  totalFacebookLeads: number;
  leadsWithLocation: number;
  coveragePct: number;
  uniqueLocations: number;
  topLocations: LeadLocationStat[];
};

const LOCATION_ALIASES: Record<string, string> = {
  byo: "Bulawayo",
  "bulawayo city": "Bulawayo",
  hre: "Harare",
  "harare city": "Harare",
};

const TERMINAL_STATUSES = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, (character) => character.toUpperCase());
}

export function normalizeLeadLocation(value: string): string | null {
  const cleaned = value
    .trim()
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ");

  if (!cleaned) return null;

  const lower = cleaned.toLocaleLowerCase();
  if (["n/a", "na", "none", "unknown", "not sure"].includes(lower)) return null;

  return LOCATION_ALIASES[lower] ?? titleCase(lower);
}

function isLocationKey(key: string): boolean {
  const normalized = key.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "_");
  return (
    normalized.includes("city_or_suburb") ||
    normalized.includes("city") ||
    normalized.includes("suburb") ||
    normalized.includes("location") ||
    normalized.includes("province") ||
    normalized === "area"
  );
}

export function extractLeadLocation(
  formData: Record<string, unknown> | null
): string | null {
  if (!formData) return null;

  for (const [key, value] of Object.entries(formData)) {
    if (!isLocationKey(key) || typeof value !== "string") continue;
    const normalized = normalizeLeadLocation(value);
    if (normalized) return normalized;
  }

  return null;
}

export function aggregateLeadLocations(
  leads: LocationLeadRow[],
  windowStart: Date,
  windowEnd: Date
): LeadLocationAnalysis {
  const rows = leads.filter((lead) => {
    const createdAt = new Date(lead.created_at).getTime();
    return createdAt >= windowStart.getTime() && createdAt <= windowEnd.getTime();
  });

  const grouped = new Map<
    string,
    Omit<LeadLocationStat, "location" | "sharePct">
  >();
  let leadsWithLocation = 0;

  for (const lead of rows) {
    const location = extractLeadLocation(lead.form_data);
    if (!location) continue;

    leadsWithLocation++;
    const current = grouped.get(location) ?? {
      leads: 0,
      open: 0,
      won: 0,
      lost: 0,
      notQualified: 0,
    };

    current.leads++;
    if (lead.status === "WON") current.won++;
    else if (lead.status === "LOST") current.lost++;
    else if (lead.status === "NOT_QUALIFIED") current.notQualified++;
    else if (!TERMINAL_STATUSES.has(lead.status)) current.open++;
    grouped.set(location, current);
  }

  const topLocations = Array.from(grouped.entries())
    .map(([location, counts]) => ({
      location,
      ...counts,
      sharePct:
        leadsWithLocation > 0
          ? Math.round((counts.leads / leadsWithLocation) * 100)
          : 0,
    }))
    .sort((a, b) => b.leads - a.leads || a.location.localeCompare(b.location));

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalFacebookLeads: rows.length,
    leadsWithLocation,
    coveragePct:
      rows.length > 0 ? Math.round((leadsWithLocation / rows.length) * 100) : 0,
    uniqueLocations: grouped.size,
    topLocations,
  };
}

export async function getLeadLocationAnalysis(
  clientId: string,
  windowDays = 90
): Promise<LeadLocationAnalysis> {
  const supabase = createAdminClient();
  const windowEnd = new Date();
  windowEnd.setHours(23, 59, 59, 999);
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  windowStart.setHours(0, 0, 0, 0);

  const pageSize = 500;
  const leads: LocationLeadRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, status, form_data, created_at")
      .eq("client_id", clientId)
      .eq("source", "FACEBOOK")
      .or("is_archived.is.null,is_archived.eq.false")
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString())
      .order("id")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load Facebook lead locations: ${error.message}`);
    }

    const page = (data ?? []) as LocationLeadRow[];
    leads.push(...page);
    if (page.length < pageSize) break;
  }

  return aggregateLeadLocations(leads, windowStart, windowEnd);
}
