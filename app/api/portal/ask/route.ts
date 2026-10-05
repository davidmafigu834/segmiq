import { NextResponse } from "next/server";
import { z } from "zod";
import { portalOriginOk } from "@/lib/portal/auth";
import { getPortalIdentity } from "@/lib/portal/service";
import { intelligenceFlags } from "@/lib/intelligence/audit";
import { withinAiBudget } from "@/lib/intelligence/budget";
import { answerPortalQuestion } from "@/lib/intelligence/portal";
import { stripTenantArgs } from "@/lib/intelligence/rules";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().min(2).max(1000),
  projectId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  if (!portalOriginOk(req)) return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  const identity = await getPortalIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const flags = await intelligenceFlags(identity.clientId);
  if (!flags.portal) return NextResponse.json({ error: "Project questions are not available on this portal yet." }, { status: 403 });
  const budget = await withinAiBudget(identity.clientId);
  if (!budget.ok) return NextResponse.json({ error: budget.reason }, { status: 429 });
  const raw = await req.json().catch(() => null);
  const body = schema.safeParse(raw && typeof raw === "object" ? stripTenantArgs(raw as Record<string, unknown>) : null);
  if (!body.success) return NextResponse.json({ error: "Ask a shorter question." }, { status: 400 });
  const result = await answerPortalQuestion(identity, body.data.question, body.data.projectId);
  return NextResponse.json(result);
}
