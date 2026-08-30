import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageListings } from "@/lib/real-estate/helpers";
import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES, COMPLAINT_STATUSES } from "@/lib/real-estate/complaints";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.enum(COMPLAINT_CATEGORIES).optional(),
  priority: z.enum(COMPLAINT_PRIORITIES).optional(),
  contact_id: z.string().uuid().nullable().optional(),
  listing_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  agent_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_complaints")
    .select(
      "*, contact:contacts(id, name), listing:listings(id, address, suburb), agent:users!customer_complaints_agent_id_fkey(id, name)"
    )
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    const fallback = await supabase
      .from("customer_complaints")
      .select("*")
      .eq("client_id", params.clientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    return NextResponse.json({ complaints: fallback.data ?? [] });
  }

  return NextResponse.json({ complaints: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageListings(session.role)) {
    return NextResponse.json({ error: "Only managers can log complaints" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", params.clientId)
    .maybeSingle();
  if (client?.business_type !== "real_estate") {
    return NextResponse.json({ error: "Complaints are only available for real estate clients" }, { status: 403 });
  }

  const body = parsed.data;
  const { data, error } = await supabase
    .from("customer_complaints")
    .insert({
      client_id: params.clientId,
      subject: body.subject.trim(),
      description: body.description?.trim() || "",
      category: body.category ?? "service",
      priority: body.priority ?? "medium",
      contact_id: body.contact_id ?? null,
      listing_id: body.listing_id ?? null,
      lead_id: body.lead_id ?? null,
      agent_id: body.agent_id ?? null,
      created_by: session.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ complaint: data }, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageListings(session.role)) {
    return NextResponse.json({ error: "Only managers can update complaints" }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patchSchema = z.object({
    status: z.enum(COMPLAINT_STATUSES).optional(),
    priority: z.enum(COMPLAINT_PRIORITIES).optional(),
    resolution_notes: z.string().max(5000).nullable().optional(),
    subject: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
  });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { ...parsed.data, updated_at: now };
  if (parsed.data.status === "resolved" || parsed.data.status === "dismissed") {
    update.resolved_at = now;
    update.resolved_by = session.userId;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_complaints")
    .update(update)
    .eq("id", id)
    .eq("client_id", params.clientId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ complaint: data });
}
