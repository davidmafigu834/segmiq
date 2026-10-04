import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { intelligenceFlags } from "@/lib/intelligence/audit";
import { answerStaffQuestion } from "@/lib/intelligence/staff";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().min(2).max(1000),
  projectId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.clientId) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (auth.role !== "CLIENT_MANAGER" && auth.role !== "SUPER_ADMIN" && auth.role !== "SALESPERSON") {
    return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  }
  const flags = await intelligenceFlags(auth.clientId);
  if (!flags.operations) return NextResponse.json({ error: "Operations intelligence is turned off for this company." }, { status: 403 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Ask a shorter question." }, { status: 400 });
  const result = await answerStaffQuestion(
    { userId: auth.userId, role: auth.role, clientId: auth.clientId },
    body.data.question,
    body.data.projectId
  );
  return NextResponse.json(result);
}
