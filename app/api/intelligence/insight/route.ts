import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { intelligenceFlags } from "@/lib/intelligence/audit";
import { loadProjectFacts } from "@/lib/intelligence/facts";
import { projectInsight } from "@/lib/intelligence/rules";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.clientId) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const flags = await intelligenceFlags(auth.clientId);
  if (!flags.operations) return NextResponse.json({ insight: null });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ insight: null });
  const facts = await loadProjectFacts({ userId: auth.userId, role: auth.role, clientId: auth.clientId }, projectId);
  if (!facts) return NextResponse.json({ insight: null });
  return NextResponse.json({ insight: projectInsight(facts) });
}
