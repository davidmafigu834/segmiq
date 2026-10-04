import { NextResponse } from "next/server";
import { z } from "zod";
import { workProjectActor } from "@/lib/work-projects/http";
import { canManageWorkProjects } from "@/lib/work-projects/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { intelligenceFlags } from "@/lib/intelligence/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  operations: z.boolean(),
  actions: z.boolean(),
});

export async function GET(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor?.clientId || !canManageWorkProjects(actor, actor.clientId)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  return NextResponse.json(await intelligenceFlags(actor.clientId));
}

export async function POST(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor?.clientId || !canManageWorkProjects(actor, actor.clientId)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the intelligence settings." }, { status: 400 });
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("agent_company_settings").select("client_id").eq("client_id", actor.clientId).maybeSingle();
  const write = existing
    ? supabase.from("agent_company_settings").update({
        operations_ai_enabled: body.data.operations,
        agent_actions_enabled: body.data.actions,
      }).eq("client_id", actor.clientId)
    : supabase.from("agent_company_settings").insert({
        client_id: actor.clientId,
        enabled: false,
        operations_ai_enabled: body.data.operations,
        agent_actions_enabled: body.data.actions,
      });
  const { error } = await write;
  if (error) return NextResponse.json({ error: "Intelligence settings could not be saved." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
