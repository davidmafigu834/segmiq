import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { intelligenceFlags } from "@/lib/intelligence/audit";
import { withinAiBudget } from "@/lib/intelligence/budget";
import { answerStaffQuestion } from "@/lib/intelligence/staff";
import { stripTenantArgs } from "@/lib/intelligence/rules";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().min(2).max(1000),
  projectId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.clientId) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (auth.role !== "CLIENT_MANAGER" && auth.role !== "SUPER_ADMIN" && auth.role !== "SALESPERSON") {
    return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  }
  const flags = await intelligenceFlags(auth.clientId);
  if (!flags.operations) return NextResponse.json({ error: "Operations intelligence is turned off for this company." }, { status: 403 });
  const budget = await withinAiBudget(auth.clientId);
  if (!budget.ok) return NextResponse.json({ error: budget.reason }, { status: 429 });
  const raw = await req.json().catch(() => null);
  const body = schema.safeParse(raw && typeof raw === "object" ? stripTenantArgs(raw as Record<string, unknown>) : null);
  if (!body.success) return NextResponse.json({ error: "Ask a shorter question." }, { status: 400 });
  const result = await answerStaffQuestion(
    { userId: auth.userId, role: auth.role, clientId: auth.clientId },
    body.data.question,
    body.data.projectId,
    { actionsEnabled: flags.actions, leadId: body.data.leadId }
  );
  return NextResponse.json(result);
}
