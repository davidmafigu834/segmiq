import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  is_active: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const g = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in g) return g.error;

  if (params.userId === g.session.userId) {
    return NextResponse.json({ error: "You cannot deactivate your own account here" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase.from("users").select("id, role").eq("id", params.userId).maybeSingle();
  if (!target || target.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("users").update({ is_active: parsed.data.is_active }).eq("id", params.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
