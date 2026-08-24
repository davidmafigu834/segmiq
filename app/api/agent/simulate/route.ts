import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { simulateAgentRun } from "@/lib/agent/runtime";
import { isAgentGloballyEnabled } from "@/lib/agent/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  leadId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

/**
 * Agent Test Mode: runs the full reasoning pipeline against a real
 * conversation with a hypothetical customer message. Mutating tools are
 * simulated and nothing is sent to the customer.
 */
export async function POST(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAgentGloballyEnabled()) {
    return NextResponse.json({ error: "Agent is not configured on this server" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id")
    .eq("id", parsed.data.leadId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const clientId = lead.client_id as string;
  const allowed =
    auth.role === "SUPER_ADMIN" ||
    (auth.clientId === clientId && auth.role === "CLIENT_MANAGER");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await simulateAgentRun({
    clientId,
    leadId: parsed.data.leadId,
    customerMessage: parsed.data.message,
  });

  return NextResponse.json({ result });
}
