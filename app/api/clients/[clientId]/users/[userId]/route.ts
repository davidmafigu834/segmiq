import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  is_active: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: { clientId: string; userId: string } }) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: u } = await supabase
    .from("users")
    .select("id, role, client_id")
    .eq("id", params.userId)
    .maybeSingle();
  if (!u || u.client_id !== params.clientId || u.role !== "SALESPERSON") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("users").update({ is_active: parsed.data.is_active }).eq("id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!parsed.data.is_active) {
    const { data: remaining } = await supabase
      .from("users")
      .select("id, round_robin_order")
      .eq("client_id", params.clientId)
      .eq("role", "SALESPERSON")
      .eq("is_active", true)
      .order("round_robin_order", { ascending: true });

    const active = remaining ?? [];

    if (active.length > 0) {
      const { data: newLeads } = await supabase
        .from("leads")
        .select("id")
        .eq("assigned_to_id", params.userId)
        .eq("status", "NEW");

      for (let i = 0; i < (newLeads ?? []).length; i++) {
        const lead = newLeads![i];
        const newAssignee = active[i % active.length];
        await supabase
          .from("leads")
          .update({ assigned_to_id: newAssignee.id })
          .eq("id", lead.id as string);
      }

      for (let i = 0; i < active.length; i++) {
        await supabase
          .from("users")
          .update({ round_robin_order: i })
          .eq("id", active[i].id as string);
      }
    }

    await supabase
      .from("clients")
      .update({ round_robin_index: 0 })
      .eq("id", params.clientId);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { clientId: string; userId: string } }) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data: u } = await supabase
    .from("users")
    .select("id, role, client_id")
    .eq("id", params.userId)
    .maybeSingle();
  if (!u || u.client_id !== params.clientId || u.role !== "SALESPERSON") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("users").delete().eq("id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
