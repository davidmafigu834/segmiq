import { createAdminClient } from "@/lib/supabase/admin";

// ============================================
// PREDEFINED SEGMENT DEFINITIONS
// These are created automatically for every client
// They cannot be deleted — only deactivated
// ============================================

type PredefinedSegment = {
  name: string;
  description: string;
  predefined_key: string;
  filters: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  filter_logic: "and" | "or";
  export_fields: string[];
  min_score: number | null;
  date_range_days: number | null;
};

export const PREDEFINED_SEGMENTS: PredefinedSegment[] = [
  {
    name: "Won customers",
    description:
      "Contacts who converted into paying customers. Upload as a custom audience to build a lookalike — this tells Facebook to find people who look like your actual buyers.",
    predefined_key: "won_customers",
    filters: [{ field: "status", operator: "eq", value: "WON" }],
    filter_logic: "and",
    export_fields: ["phone", "email", "name"],
    min_score: null,
    date_range_days: null,
  },
  {
    name: "Contacted but did not convert",
    description:
      "Leads who answered the phone but did not close. These are warm — they know the company. Retarget them with a specific offer or testimonial creative.",
    predefined_key: "contacted_not_converted",
    filters: [
      {
        field: "status",
        operator: "in",
        value: ["CONTACTED", "QUALIFIED", "NEGOTIATING"],
      },
    ],
    filter_logic: "and",
    export_fields: ["phone", "email", "name"],
    min_score: null,
    date_range_days: 90,
  },
  {
    name: "Never answered",
    description:
      "Leads who submitted a form but never picked up the phone. Can be retargeted with a different message or excluded from campaigns to improve ad efficiency.",
    predefined_key: "never_answered",
    filters: [
      { field: "status", operator: "eq", value: "NEW" },
      { field: "score", operator: "lt", value: 30 },
    ],
    filter_logic: "and",
    export_fields: ["phone", "email", "name"],
    min_score: null,
    date_range_days: 60,
  },
  {
    name: "High budget — did not convert",
    description:
      "Leads who indicated a high budget but did not close. High-value retargeting audience — these people had money and intent. A different approach or offer may close them.",
    predefined_key: "high_budget_unconverted",
    filters: [
      {
        field: "budget_estimate_usd",
        operator: "gte",
        value: 10000,
      },
      {
        field: "status",
        operator: "not_in",
        value: ["WON", "LOST", "NOT_QUALIFIED"],
      },
    ],
    filter_logic: "and",
    export_fields: ["phone", "email", "name"],
    min_score: null,
    date_range_days: 120,
  },
  {
    name: "Immediate urgency leads",
    description:
      "Leads who said they need the service immediately or very soon. If they did not convert quickly they may be buying from a competitor. Retarget fast.",
    predefined_key: "immediate_urgency",
    filters: [
      {
        field: "urgency_level",
        operator: "in",
        value: ["immediate", "soon"],
      },
      {
        field: "status",
        operator: "not_in",
        value: ["WON", "LOST", "NOT_QUALIFIED"],
      },
    ],
    filter_logic: "and",
    export_fields: ["phone", "email", "name"],
    min_score: null,
    date_range_days: 30,
  },
  {
    name: "High intent — not yet contacted",
    description:
      "Leads with a high intent score who have never been called. These are your hottest uncontacted leads. Use as a retargeting audience to keep the brand visible while the team calls.",
    predefined_key: "high_intent",
    filters: [
      { field: "intent_score", operator: "gte", value: 70 },
      { field: "status", operator: "eq", value: "NEW" },
    ],
    filter_logic: "and",
    export_fields: ["phone", "email", "name"],
    min_score: null,
    date_range_days: 60,
  },
];

// ============================================
// SEED PREDEFINED SEGMENTS FOR A CLIENT
// Called when a client is first created
// or when running the daily cron to ensure
// all clients have the predefined segments
// ============================================

export async function seedPredefinedSegments(clientId: string): Promise<void> {
  const supabase = createAdminClient();

  // Check which predefined segments already exist for this client
  const { data: existing } = await supabase
    .from("audience_segments")
    .select("predefined_key")
    .eq("client_id", clientId)
    .eq("segment_type", "predefined");

  const existingKeys = new Set(
    (existing ?? []).map((s) => s.predefined_key as string)
  );

  // Insert any missing predefined segments
  const toInsert = PREDEFINED_SEGMENTS.filter(
    (seg) => !existingKeys.has(seg.predefined_key)
  );

  if (toInsert.length === 0) return;

  const rows = toInsert.map((seg) => ({
    client_id: clientId,
    name: seg.name,
    description: seg.description,
    segment_type: "predefined",
    predefined_key: seg.predefined_key,
    filters: seg.filters,
    filter_logic: seg.filter_logic,
    export_fields: seg.export_fields,
    min_score: seg.min_score,
    date_range_days: seg.date_range_days,
    is_active: true,
  }));

  const { error } = await supabase.from("audience_segments").insert(rows);

  if (error) {
    console.error(
      `seedPredefinedSegments: failed for client ${clientId}:`,
      error
    );
  }
}

export async function seedAllClientSegments(): Promise<void> {
  const supabase = createAdminClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("is_active", true)
    .eq("is_archived", false);

  for (const client of clients ?? []) {
    try {
      await seedPredefinedSegments(client.id as string);
    } catch (err) {
      console.error(
        `seedAllClientSegments: failed for client ${client.id as string}:`,
        err
      );
    }
  }
}

// ============================================
// SEGMENT QUERY BUILDER
// Translates the filters jsonb into a
// Supabase query that returns matching leads
// ============================================

type LeadRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  score: number;
  source: string;
  created_at: string;
  is_stale: boolean;
  lead_intelligence?: Array<{
    intent_score: number;
    urgency_level: string;
    intent_category: string;
    budget_estimate_usd: number | null;
    property_type: string | null;
    tags: string[];
  }> | null;
};

export type SegmentFilter = {
  field: string;
  operator: string;
  value: unknown;
};

// Intelligence fields that must be filtered in memory
const INTELLIGENCE_FIELDS = new Set([
  "intent_score",
  "urgency_level",
  "intent_category",
  "budget_estimate_usd",
  "property_type",
  "tags",
]);

export async function resolveSegmentLeads(
  clientId: string,
  filters: SegmentFilter[],
  filterLogic: "and" | "or",
  options?: {
    minScore?: number | null;
    dateRangeDays?: number | null;
    exportFields?: string[];
  }
): Promise<LeadRow[]> {
  const supabase = createAdminClient();

  // Base query — all active leads for this client with intelligence joined
  let query = supabase
    .from("leads")
    .select(
      `
      id,
      name,
      phone,
      email,
      status,
      score,
      source,
      created_at,
      is_stale,
      lead_intelligence (
        intent_score,
        urgency_level,
        intent_category,
        budget_estimate_usd,
        property_type,
        tags
      )
    `
    )
    .eq("client_id", clientId)
    .eq("is_archived", false);

  // Apply date range if set
  if (options?.dateRangeDays) {
    const since = new Date();
    since.setDate(since.getDate() - options.dateRangeDays);
    query = query.gte("created_at", since.toISOString());
  }

  // Apply minimum score if set
  if (options?.minScore != null) {
    query = query.gte("score", options.minScore);
  }

  // Apply lead-level filters that Supabase can handle directly
  // Intelligence-level filters are applied in memory after fetch
  for (const filter of filters) {
    const { field, operator, value } = filter;

    if (INTELLIGENCE_FIELDS.has(field)) continue;

    switch (operator) {
      case "eq":
        query = query.eq(field, value as string);
        break;
      case "neq":
        query = query.neq(field, value as string);
        break;
      case "gt":
        query = query.gt(field, value as number);
        break;
      case "gte":
        query = query.gte(field, value as number);
        break;
      case "lt":
        query = query.lt(field, value as number);
        break;
      case "lte":
        query = query.lte(field, value as number);
        break;
      case "in":
        query = query.in(
          field,
          Array.isArray(value) ? (value as string[]) : [value as string]
        );
        break;
      case "not_in": {
        const vals = Array.isArray(value)
          ? (value as string[])
          : [value as string];
        query = query.not(field, "in", `(${vals.join(",")})`);
        break;
      }
    }
  }

  const { data } = await query;
  let leads = (data ?? []) as LeadRow[];

  // Apply intelligence-level filters in memory
  const intelligenceFilters = filters.filter((f) =>
    INTELLIGENCE_FIELDS.has(f.field)
  );

  if (intelligenceFilters.length > 0) {
    leads = leads.filter((lead) => {
      const intelRaw = lead.lead_intelligence;
      const intel = Array.isArray(intelRaw) ? intelRaw[0] ?? null : intelRaw ?? null;

      const results = intelligenceFilters.map((filter) => {
        const { field, operator, value } = filter;
        const fieldValue = intel
          ? (intel as unknown as Record<string, unknown>)[field]
          : undefined;

        if (fieldValue === undefined || fieldValue === null) return false;

        switch (operator) {
          case "eq":
            return fieldValue === value;
          case "neq":
            return fieldValue !== value;
          case "gt":
            return (fieldValue as number) > (value as number);
          case "gte":
            return (fieldValue as number) >= (value as number);
          case "lt":
            return (fieldValue as number) < (value as number);
          case "lte":
            return (fieldValue as number) <= (value as number);
          case "in":
            return Array.isArray(value) && (value as unknown[]).includes(fieldValue);
          case "not_in":
            return Array.isArray(value) && !(value as unknown[]).includes(fieldValue);
          case "contains":
            // For tags array
            if (Array.isArray(fieldValue)) {
              return (fieldValue as unknown[]).includes(value);
            }
            return false;
          default:
            return true;
        }
      });

      return filterLogic === "and"
        ? results.every(Boolean)
        : results.some(Boolean);
    });
  }

  return leads;
}

// ============================================
// CSV GENERATION
// Produces a Meta-compatible CSV
// ============================================

export function generateAudienceCSV(
  leads: LeadRow[],
  exportFields: string[]
): string {
  // Meta CSV column headers
  // Meta matches on: phone, email, fn (first name), ln (last name)
  const metaFieldMap: Record<string, string> = {
    phone: "phone",
    email: "email",
    name: "fn",
  };

  const headers = exportFields
    .filter((f) => metaFieldMap[f])
    .map((f) => metaFieldMap[f]);

  const rows = leads
    .filter((lead) => {
      // Only include leads that have at least one of the requested fields
      return exportFields.some((field) => {
        if (field === "phone") return !!lead.phone;
        if (field === "email") return !!lead.email;
        if (field === "name") return !!lead.name;
        return false;
      });
    })
    .map((lead) => {
      return exportFields
        .filter((f) => metaFieldMap[f])
        .map((field) => {
          if (field === "phone") {
            // Normalise phone — remove spaces, ensure + prefix
            const phone = (lead.phone ?? "").replace(/\s/g, "");
            return phone.startsWith("+") ? phone : `+${phone}`;
          }
          if (field === "email") return lead.email ?? "";
          if (field === "name") {
            // For Meta we send first name only in fn column
            return (lead.name ?? "").split(" ")[0];
          }
          return "";
        })
        .join(",");
    });

  return [headers.join(","), ...rows].join("\n");
}
