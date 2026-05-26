import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ============================================
// PATCH /api/clients/[clientId]/segments/[segmentId]
// Updates a custom segment (not predefined)
// Agency admin only
// ============================================

const updateSegmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  filters: z
    .array(
      z.object({
        field: z.string(),
        operator: z.string(),
        value: z.unknown(),
      })
    )
    .optional(),
  filter_logic: z.enum(["and", "or"]).optional(),
  export_fields: z
    .array(z.enum(["phone", "email", "name"]))
    .optional(),
  min_score: z.number().int().min(0).max(100).nullable().optional(),
  date_range_days: z.number().int().min(1).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; segmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Verify the segment belongs to this client and is custom (not predefined)
  const { data: existing } = await supabase
    .from("audience_segments")
    .select("id, segment_type")
    .eq("id", params.segmentId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }

  if (existing.segment_type === "predefined") {
    return NextResponse.json(
      { error: "Predefined segments cannot be modified" },
      { status: 403 }
    );
  }

  const parsed = updateSegmentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.filters !== undefined) updates.filters = parsed.data.filters;
  if (parsed.data.filter_logic !== undefined) updates.filter_logic = parsed.data.filter_logic;
  if (parsed.data.export_fields !== undefined) updates.export_fields = parsed.data.export_fields;
  if (parsed.data.min_score !== undefined) updates.min_score = parsed.data.min_score;
  if (parsed.data.date_range_days !== undefined) updates.date_range_days = parsed.data.date_range_days;

  const { data: segment, error } = await supabase
    .from("audience_segments")
    .update(updates)
    .eq("id", params.segmentId)
    .eq("client_id", params.clientId)
    .select("*")
    .single();

  if (error || !segment) {
    console.error("[PATCH /api/clients/[clientId]/segments/[segmentId]]", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update segment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ segment });
}

// ============================================
// DELETE /api/clients/[clientId]/segments/[segmentId]
// Soft-deletes a custom segment (is_active = false)
// Predefined segments cannot be deleted
// Agency admin only
// ============================================

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; segmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("audience_segments")
    .select("id, segment_type")
    .eq("id", params.segmentId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }

  if (existing.segment_type === "predefined") {
    return NextResponse.json(
      { error: "Predefined segments cannot be deleted" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("audience_segments")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.segmentId)
    .eq("client_id", params.clientId);

  if (error) {
    console.error("[DELETE /api/clients/[clientId]/segments/[segmentId]]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
