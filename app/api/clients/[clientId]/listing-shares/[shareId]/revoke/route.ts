import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeShareLink } from "@/lib/real-estate/agent-listing-pages/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ reason: z.string().max(200).nullable().optional() });

export async function POST(req: Request, { params }: { params: { clientId: string; shareId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 });
  const result = await revokeShareLink(
    createAdminClient(),
    { userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId, alsoSells: guard.session.alsoSells },
    params.clientId,
    params.shareId,
    parsed.data.reason ?? null
  );
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result);
}
