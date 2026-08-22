import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotation_approval_policies")
    .select("*")
    .eq("client_id", params.clientId)
    .order("priority", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policies: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit approval policies" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name: string;
    trigger_type: string;
    operator?: string;
    threshold_numeric?: number | null;
    threshold_text?: string | null;
    approver_role?: string | null;
    approver_user_id?: string | null;
    sequence_group?: number;
    priority?: number;
    is_active?: boolean;
  };
  if (!body.name?.trim() || !body.trigger_type) {
    return NextResponse.json({ error: "Name and trigger are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotation_approval_policies")
    .insert({
      client_id: params.clientId,
      name: body.name.trim(),
      trigger_type: body.trigger_type,
      operator: body.operator ?? "gt",
      threshold_numeric: body.threshold_numeric != null ? Number(body.threshold_numeric) : null,
      threshold_text: body.threshold_text ?? null,
      approver_role: body.approver_role ?? "CLIENT_MANAGER",
      approver_user_id: body.approver_user_id ?? null,
      sequence_group: body.sequence_group ?? 1,
      priority: body.priority ?? 100,
      is_active: body.is_active !== false,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policy: data }, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit approval policies" }, { status: 403 });
  }
  const body = (await req.json()) as { id: string } & Record<string, unknown>;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "name",
    "is_active",
    "trigger_type",
    "operator",
    "threshold_numeric",
    "threshold_text",
    "approver_role",
    "approver_user_id",
    "sequence_group",
    "priority",
  ]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotation_approval_policies")
    .update(updates)
    .eq("id", body.id)
    .eq("client_id", params.clientId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policy: data });
}

export async function DELETE(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit approval policies" }, { status: 403 });
  }
  const body = (await req.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("quotation_approval_policies")
    .delete()
    .eq("id", body.id)
    .eq("client_id", params.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
