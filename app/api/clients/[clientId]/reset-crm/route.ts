import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { resetCompanyCrm } from "@/lib/clients/reset-crm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  confirmName: z.string().min(1),
});

/**
 * Super-admin only. Wipes operational CRM data so a company can start over
 * without losing the account, team, catalog, or connections.
 */
export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in guard) return guard.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Type the company name to confirm." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", params.clientId)
    .maybeSingle();
  if (error || !existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const savedName = String(existing.name ?? "").trim();
  if (!savedName || parsed.data.confirmName.trim() !== savedName) {
    return NextResponse.json({ error: "Name does not match — reset cancelled" }, { status: 400 });
  }

  const result = await resetCompanyCrm(supabase, params.clientId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: result.deleted });
}
