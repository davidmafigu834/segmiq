import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canModifyLead, canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function resolveAccess(leadId: string, req: Request) {
  const modify = await canModifyLead(leadId, req);
  if (modify.allowed) return { ok: true as const, userId: modify.userId };
  const session = await getServerSession(authOptions);
  if (session?.role === "CLIENT_MANAGER") {
    const read = await canReadLead(leadId, req);
    if (read.ok) return { ok: true as const, userId: session.userId! };
  }
  return { ok: false as const, status: modify.status, reason: modify.reason };
}

export async function POST(req: Request, { params }: { params: { leadId: string; eventId: string } }) {
  const access = await resolveAccess(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from("lead_events")
    .select("id, lead_id")
    .eq("id", params.eventId)
    .eq("lead_id", params.leadId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("lead_events")
    .update({ pinned_at: now, pinned_by: access.userId })
    .eq("id", params.eventId);

  if (error) {
    console.error("[timeline pin]", error);
    return NextResponse.json({ error: "Could not pin activity" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pinnedAt: now });
}

export async function DELETE(req: Request, { params }: { params: { leadId: string; eventId: string } }) {
  const access = await resolveAccess(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from("lead_events")
    .select("id")
    .eq("id", params.eventId)
    .eq("lead_id", params.leadId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("lead_events")
    .update({ pinned_at: null, pinned_by: null })
    .eq("id", params.eventId);

  if (error) {
    console.error("[timeline unpin]", error);
    return NextResponse.json({ error: "Could not unpin activity" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
