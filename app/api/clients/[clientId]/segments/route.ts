import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { resolveSegmentLeads } from "@/lib/audience-segments";

export const dynamic = "force-dynamic";

// ============================================
// GET /api/clients/[clientId]/segments
// Returns all active segments for a client
// with a live lead count for each
// ============================================

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessClient(session.role, session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: segments, error } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("client_id", params.clientId)
    .eq("is_active", true)
    .order("segment_type", { ascending: false }) // predefined first
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve lead counts for each segment in parallel
  const segmentsWithCounts = await Promise.all(
    (segments ?? []).map(async (segment) => {
      try {
        const leads = await resolveSegmentLeads(
          params.clientId,
          (segment.filters as Array<{ field: string; operator: string; value: unknown }>) ?? [],
          (segment.filter_logic as "and" | "or") ?? "and",
          {
            minScore: segment.min_score as number | null,
            dateRangeDays: segment.date_range_days as number | null,
          }
        );
        return { ...segment, lead_count: leads.length };
      } catch {
        return { ...segment, lead_count: null };
      }
    })
  );

  return NextResponse.json({ segments: segmentsWithCounts });
}

// ============================================
// POST /api/clients/[clientId]/segments
// Creates a new custom segment
// Agency admin only
// ============================================

const createSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  filters: z.array(
    z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown(),
    })
  ),
  filter_logic: z.enum(["and", "or"]).default("and"),
  export_fields: z
    .array(z.enum(["phone", "email", "name"]))
    .default(["phone", "email", "name"]),
  min_score: z.number().int().min(0).max(100).nullable().optional(),
  date_range_days: z.number().int().min(1).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSegmentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: segment, error } = await supabase
    .from("audience_segments")
    .insert({
      client_id: params.clientId,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() ?? null,
      segment_type: "custom",
      predefined_key: null,
      filters: parsed.data.filters,
      filter_logic: parsed.data.filter_logic,
      export_fields: parsed.data.export_fields,
      min_score: parsed.data.min_score ?? null,
      date_range_days: parsed.data.date_range_days ?? null,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !segment) {
    console.error("[POST /api/clients/[clientId]/segments]", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to create segment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ segment });
}
