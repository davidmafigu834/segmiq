import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  agency_managed: z.boolean(),
});

/**
 * Toggle whether Segmiq is this client's managed marketing partner.
 * Super Admin retains Meta/billing access either way; this is a relationship flag.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isOwnManager =
    session.role === "CLIENT_MANAGER" && session.clientId === params.clientId;

  if (!isSuperAdmin && !isOwnManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing, error: exErr } = await supabase
    .from("clients")
    .select("id, agency_managed")
    .eq("id", params.clientId)
    .maybeSingle();

  if (exErr || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next = parsed.data.agency_managed;
  if (existing.agency_managed === next) {
    return NextResponse.json({
      id: params.clientId,
      agency_managed: next,
      unchanged: true,
    });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("clients")
    .update({
      agency_managed: next,
      agency_managed_changed_at: now,
      agency_managed_changed_by: session.userId,
    })
    .eq("id", params.clientId)
    .select("id, agency_managed, agency_managed_changed_at, agency_managed_changed_by")
    .single();

  if (error) {
    console.error("[agency-managed]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
