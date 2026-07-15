import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { setSessionToken } from "@/lib/auth/session-token";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isImpersonating || !session.realUserId) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: admin } = await supabase
    .from("users")
    .select("id, name, email, role, client_id, is_active, session_version")
    .eq("id", session.realUserId)
    .maybeSingle();

  if (!admin || admin.role !== "AGENCY_ADMIN" || !admin.is_active) {
    return NextResponse.json({ error: "Admin session invalid" }, { status: 403 });
  }

  await setSessionToken({
    userId: admin.id as string,
    role: admin.role as UserRole,
    clientId: null,
    clientMode: "team",
    sessionVersion: Number((admin as { session_version?: number }).session_version ?? 0),
    email: (admin.email as string | null) ?? null,
    name: admin.name as string,
  });

  return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}
