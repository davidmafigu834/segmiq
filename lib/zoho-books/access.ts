import "server-only";
import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requirePermission } from "@/lib/auth/rbac/require";

export type ZohoActor = {
  userId: string;
  clientId: string;
  sessionId: string;
};

export async function requireZohoBooksManager(
  req: Request
): Promise<{ ok: true; actor: ZohoActor } | { ok: false; response: NextResponse }> {
  const gate = await requirePermission(P.SETTINGS_INTEGRATIONS, req);
  if ("error" in gate) return { ok: false, response: gate.error };
  if (!gate.auth.clientId || !gate.auth.sessionId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {
    ok: true,
    actor: {
      userId: gate.auth.userId,
      clientId: gate.auth.clientId,
      sessionId: gate.auth.sessionId,
    },
  };
}
