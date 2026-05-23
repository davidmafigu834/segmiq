import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const body = (await req.json()) as Record<string, unknown>;

  const { data, error } = await supabase
    .from("pricing_packages")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.packageId)
    .eq("client_id", params.clientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ package: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  await supabase
    .from("pricing_packages")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.packageId)
    .eq("client_id", params.clientId);

  return NextResponse.json({ success: true });
}
