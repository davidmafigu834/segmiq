import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadLead } from "@/lib/auth/permissions";
import { processLeadIntelligence } from "@/lib/lead-intelligence";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { leadId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await canReadLead(params.leadId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();

  const { data: intelligence } = await supabase
    .from("lead_intelligence")
    .select("*")
    .eq("lead_id", params.leadId)
    .single();

  return NextResponse.json({ intelligence: intelligence ?? null });
}

// POST — trigger reprocessing on demand
export async function POST(
  _req: Request,
  { params }: { params: { leadId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only agency admins and client managers can trigger reprocessing
  if (!["AGENCY_ADMIN", "CLIENT_MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const access = await canReadLead(params.leadId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  try {
    await processLeadIntelligence(params.leadId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[intelligence] reprocessing failed for lead ${params.leadId}:`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
