import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions, resolveClientMode } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canBeImpersonated, homeForRole } from "@/lib/auth/impersonation";
import { setSessionToken } from "@/lib/auth/session-token";
import type { ClientMode, UserRole } from "@/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.isImpersonating) {
    return NextResponse.json({ error: "Already impersonating — stop first" }, { status: 400 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [{ data: admin }, { data: target }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, role, session_version")
      .eq("id", session.userId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, name, email, role, client_id, is_active, also_sells")
      .eq("id", body.userId)
      .maybeSingle(),
  ]);

  if (!admin || admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!canBeImpersonated(target as { role: string; client_id: string | null; is_active: boolean })) {
    return NextResponse.json({ error: "This user cannot be impersonated" }, { status: 403 });
  }

  const clientId = target.client_id as string;
  const clientMode = await resolveClientMode(clientId);
  const role = target.role as UserRole;

  await setSessionToken({
    userId: target.id as string,
    role,
    clientId,
    clientMode,
    alsoSells: Boolean((target as { also_sells?: boolean }).also_sells),
    sessionVersion: Number((admin as { session_version?: number }).session_version ?? 0),
    email: (target.email as string | null) ?? null,
    name: target.name as string,
    realUserId: admin.id as string,
    realUserName: admin.name as string,
  });

  return NextResponse.json({
    ok: true,
    redirectTo: homeForRole(role, clientMode as ClientMode),
    user: {
      id: target.id,
      name: target.name,
      role,
      clientId,
      clientMode,
    },
  });
}
