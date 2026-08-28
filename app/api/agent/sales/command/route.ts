import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { canUseSalesCommand } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSalesCommand, loadSalesCommandBootstrap, runSalesCommand } from "@/lib/agent/sales";
import { getSalesAgentFlags } from "@/lib/agent/sales/settings";
import type { SalesActor, SalesPageContext } from "@/lib/agent/sales/types";

export const dynamic = "force-dynamic";

async function resolveSalesActor(
  req: Request,
  companyFallback?: string | null
): Promise<
  | { ok: true; actor: SalesActor }
  | { ok: false; status: number; error: string }
> {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Unauthorized" };
  if (!canUseSalesCommand({ ...auth, clientId: auth.clientId || companyFallback || null })) {
    return { ok: false, status: 403, error: "Sales Command Center is available to salespeople." };
  }
  const clientId = auth.clientId || companyFallback || null;
  if (!clientId) return { ok: false, status: 400, error: "Company context required" };
  const supabase = createAdminClient();
  const { data: user } = await supabase.from("users").select("name").eq("id", auth.userId).maybeSingle();
  return {
    ok: true,
    actor: {
      userId: auth.userId,
      role: auth.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : auth.role === "CLIENT_MANAGER" ? "CLIENT_MANAGER" : "SALESPERSON",
      clientId,
      name: (user as { name?: string } | null)?.name || "Salesperson",
    },
  };
}

const optionalId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : value === null ? null : undefined),
  z.string().min(1).max(80).nullable().optional()
);

const pageContextSchema = z
  .object({
    conversationId: optionalId,
    leadId: optionalId,
    customerId: optionalId,
    dealId: optionalId,
    quotationId: optionalId,
    ownerId: optionalId,
    companyId: optionalId,
    currentUserId: optionalId,
  })
  .nullable()
  .optional();

const postSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid().nullable().optional(),
  pageContext: pageContextSchema,
  commandId: z.string().uuid().nullable().optional().catch(null),
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
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const access = await resolveSalesActor(req, parsed.data.pageContext?.companyId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

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
  const url = new URL(req.url);
  const access = await resolveSalesActor(req, url.searchParams.get("companyId"));
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
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
    companyId: url.searchParams.get("companyId"),
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
