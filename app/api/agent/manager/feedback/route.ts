import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveManagerActor } from "../chat/route";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  executionId: z.string().uuid(),
  helpful: z.boolean(),
  category: z
    .enum(["wrong_records", "wrong_interpretation", "wrong_metric", "missing_context", "outdated_data"])
    .optional(),
});

export async function POST(req: Request) {
  const access = await resolveManagerActor(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("agent_executions")
    .update({
      manager_feedback: {
        helpful: parsed.data.helpful,
        category: parsed.data.category ?? null,
        at: new Date().toISOString(),
      },
    })
    .eq("id", parsed.data.executionId)
    .eq("client_id", access.actor.clientId)
    .eq("trigger_kind", "MANAGER");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
