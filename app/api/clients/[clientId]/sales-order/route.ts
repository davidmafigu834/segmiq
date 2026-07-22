import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageClientTeam } from "@/lib/auth/permissions";
import { fetchRoundRobinEligibleUsers } from "@/lib/auth/sales-capabilities";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  orderedUserIds: z.array(z.string().uuid()),
});

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageClientTeam(session, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ids = parsed.data.orderedUserIds;

  const { data: sales } = await fetchRoundRobinEligibleUsers(supabase, params.clientId);

  const valid = new Set(((sales ?? []) as unknown as Array<{ id: string }>).map((s) => s.id));
  if (ids.length !== valid.size || ids.some((id) => !valid.has(id))) {
    return NextResponse.json(
      { error: "Ordered list must include each active salesperson exactly once" },
      { status: 400 }
    );
  }

  for (let i = 0; i < ids.length; i++) {
    await supabase.from("users").update({ round_robin_order: i }).eq("id", ids[i]);
  }

  return NextResponse.json({ ok: true });
}
