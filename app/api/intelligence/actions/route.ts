import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { intelligenceFlags } from "@/lib/intelligence/audit";
import { approveStaffAction } from "@/lib/intelligence/staff";

export const dynamic = "force-dynamic";

const schema = z.object({
  actionId: z.string().uuid(),
  decision: z.enum(["approve", "cancel"]),
});

export async function POST(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth?.clientId) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const flags = await intelligenceFlags(auth.clientId);
  if (!flags.actions) return NextResponse.json({ error: "Agent actions are turned off for this company." }, { status: 403 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "That action could not be confirmed." }, { status: 400 });
  const result = await approveStaffAction(
    { userId: auth.userId, role: auth.role, clientId: auth.clientId },
    body.data.actionId,
    body.data.decision
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ message: result.message });
}
