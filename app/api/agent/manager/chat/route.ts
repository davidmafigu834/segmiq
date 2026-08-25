import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { runManagerTurn, getManagerAttention } from "@/lib/agent/manager";
import type { ManagerActor } from "@/lib/agent/manager/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function resolveManagerActor(req: Request): Promise<
  | { ok: true; actor: ManagerActor }
  | { ok: false; status: number; error: string }
> {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Unauthorized" };
  const url = new URL(req.url);
  const requested = url.searchParams.get("clientId");
  let clientId: string | null = null;
  if (auth.role === "SUPER_ADMIN") {
    clientId = requested ?? auth.clientId;
    if (!clientId) return { ok: false, status: 400, error: "clientId required" };
  } else if (auth.role === "CLIENT_MANAGER" && auth.clientId) {
    if (requested && requested !== auth.clientId) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    clientId = auth.clientId;
  } else {
    return { ok: false, status: 403, error: "Command Center is available to company managers." };
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase.from("users").select("name, also_sells").eq("id", auth.userId).maybeSingle();
  return {
    ok: true,
    actor: {
      userId: auth.userId,
      role: auth.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "CLIENT_MANAGER",
      clientId,
      alsoSells: Boolean((user as { also_sells?: boolean } | null)?.also_sells ?? auth.alsoSells),
      name: (user as { name?: string } | null)?.name || "Manager",
    },
  };
}

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid().nullable().optional(),
  pageContext: z.record(z.unknown()).nullable().optional(),
});

export async function POST(req: Request) {
  const access = await resolveManagerActor(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = chatSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("name").eq("id", access.actor.clientId).maybeSingle();

  try {
    const result = await runManagerTurn({
      actor: access.actor,
      message: parsed.data.message,
      sessionId: parsed.data.sessionId,
      pageContext: parsed.data.pageContext,
      companyName: (client as { name?: string } | null)?.name,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[manager-agent]", err);
    return NextResponse.json({ error: "Command Center could not complete that request." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const access = await resolveManagerActor(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const snapshot = await getManagerAttention(access.actor);
  return NextResponse.json({ snapshot });
}
