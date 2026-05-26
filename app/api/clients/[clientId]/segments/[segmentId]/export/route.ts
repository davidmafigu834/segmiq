import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import {
  resolveSegmentLeads,
  generateAudienceCSV,
} from "@/lib/audience-segments";

export const dynamic = "force-dynamic";

// ============================================
// GET /api/clients/[clientId]/segments/[segmentId]/export
// Returns a masked preview of the leads in this segment
// Used in the export modal before triggering the full download
// Salesperson role is blocked from this endpoint
// ============================================

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; segmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canAccessClient(session.role, session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: segment } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("id", params.segmentId)
    .eq("client_id", params.clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (!segment) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }

  const leads = await resolveSegmentLeads(
    params.clientId,
    (segment.filters as Array<{ field: string; operator: string; value: unknown }>) ?? [],
    (segment.filter_logic as "and" | "or") ?? "and",
    {
      minScore: segment.min_score as number | null,
      dateRangeDays: segment.date_range_days as number | null,
    }
  );

  const { searchParams } = new URL(req.url);
  const previewLimit = Math.min(
    parseInt(searchParams.get("limit") ?? "5"),
    10
  );

  // Return masked preview — partial phone/email
  const preview = leads.slice(0, previewLimit).map((lead) => ({
    name: lead.name ?? "—",
    phone: lead.phone
      ? lead.phone.slice(0, 4) + "••••" + lead.phone.slice(-2)
      : null,
    email: lead.email
      ? lead.email.split("@")[0].slice(0, 3) + "•••@" + lead.email.split("@")[1]
      : null,
    status: lead.status,
    score: lead.score,
  }));

  return NextResponse.json({
    totalCount: leads.length,
    preview,
    exportFields: (segment.export_fields as string[]) ?? ["phone", "email", "name"],
  });
}

// ============================================
// POST /api/clients/[clientId]/segments/[segmentId]/export
// Generates and returns the CSV as a downloadable file
// Logs the export to audience_export_history
// Salesperson role is blocked
// ============================================

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; segmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canAccessClient(session.role, session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: segment } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("id", params.segmentId)
    .eq("client_id", params.clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (!segment) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }

  const exportFields =
    (segment.export_fields as string[] | null) ?? ["phone", "email", "name"];

  const leads = await resolveSegmentLeads(
    params.clientId,
    (segment.filters as Array<{ field: string; operator: string; value: unknown }>) ?? [],
    (segment.filter_logic as "and" | "or") ?? "and",
    {
      minScore: segment.min_score as number | null,
      dateRangeDays: segment.date_range_days as number | null,
      exportFields,
    }
  );

  const csv = generateAudienceCSV(leads, exportFields);

  // Log the export
  await supabase.from("audience_export_history").insert({
    segment_id: params.segmentId,
    client_id: params.clientId,
    exported_by: session.userId,
    exported_by_name: session.user.name ?? null,
    contact_count: leads.length,
    fields_exported: exportFields,
  });

  // Update segment metadata
  await supabase
    .from("audience_segments")
    .update({
      last_exported_at: new Date().toISOString(),
      last_export_count: leads.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.segmentId);

  const segmentName = (segment.name as string).replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `${segmentName}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
