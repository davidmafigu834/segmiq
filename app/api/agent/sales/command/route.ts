import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSalesCommand, loadSalesCommandBootstrap, runSalesCommand } from "@/lib/agent/sales";
import { getSalesAgentFlags } from "@/lib/agent/sales/settings";
import type { SalesActor, SalesPageContext } from "@/lib/agent/sales/types";

export const dynamic = "force-dynamic";

export async function resolveSalesActor(req: Request): Promise<
  | { ok: true; actor: SalesActor }
  | { ok: false; status: number; error: string }
> {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Unauthorized" };
  if (!canActAsSalesperson(auth)) {
    return { ok: false, status: 403, error: "Sales Command Center is available to salespeople." };
  }
  if (!auth.clientId) return { ok: false, status: 400, error: "Company context required" };
  const supabase = createAdminClient();
  const { data: user } = await supabase.from("users").select("name").eq("id", auth.userId).maybeSingle();
  return {
    ok: true,
    actor: {
      userId: auth.userId,
      role: auth.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : auth.role === "CLIENT_MANAGER" ? "CLIENT_MANAGER" : "SALESPERSON",
      clientId: auth.clientId,
      name: (user as { name?: string } | null)?.name || "Salesperson",
    },
  };
}

const pageContextSchema = z
  .object({
    conversationId: z.string().uuid().nullable().optional(),
    leadId: z.string().uuid().nullable().optional(),
    customerId: z.string().uuid().nullable().optional(),
    dealId: z.string().uuid().nullable().optional(),
    quotationId: z.string().uuid().nullable().optional(),
    ownerId: z.string().uuid().nullable().optional(),
    companyId: z.string().uuid().nullable().optional(),
    currentUserId: z.string().uuid().nullable().optional(),
  })
  .nullable()
  .optional();

const postSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid().nullable().optional(),
  pageContext: pageContextSchema,
  commandId: z.string().uuid().nullable().optional(),
  surface: z.enum(["command_center", "drawer"]).optional(),
  selection: z
    .object({
      id: z.string(),
      kind: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const access = await resolveSalesActor(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("name").eq("id", access.actor.clientId).maybeSingle();

  try {
    const result = await runSalesCommand({
      actor: access.actor,
      message: parsed.data.message,
      sessionId: parsed.data.sessionId,
      pageContext: (parsed.data.pageContext ?? {}) as SalesPageContext,
      commandId: parsed.data.commandId,
      selection: parsed.data.selection,
      companyName: (client as { name?: string } | null)?.name,
      surface: parsed.data.surface,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[sales-agent]", err);
    return NextResponse.json({ error: "Sales Command Center could not complete that request." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const access = await resolveSalesActor(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const url = new URL(req.url);
  if (url.searchParams.get("flagsOnly") === "1") {
    const flags = await getSalesAgentFlags(access.actor.clientId);
    return NextResponse.json({ flags });
  }
  const page: SalesPageContext = {
    conversationId: url.searchParams.get("conversationId"),
    leadId: url.searchParams.get("leadId"),
    customerId: url.searchParams.get("customerId"),
    dealId: url.searchParams.get("dealId"),
    quotationId: url.searchParams.get("quotationId"),
  };
  const bootstrap = await loadSalesCommandBootstrap(access.actor, page);
  return NextResponse.json(bootstrap);
}

export async function DELETE(req: Request) {
  const access = await resolveSalesActor(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  await cancelSalesCommand({ actor: access.actor, sessionId: body.sessionId });
  return NextResponse.json({ ok: true });
}
