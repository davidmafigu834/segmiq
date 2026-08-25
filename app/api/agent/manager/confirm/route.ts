import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmManagerAction } from "@/lib/agent/manager";
import { resolveManagerActor } from "../chat/route";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  confirmationId: z.string().uuid(),
  decision: z.enum(["confirm", "cancel"]),
});

export async function POST(req: Request) {
  const access = await resolveManagerActor(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (parsed.data.decision === "cancel") {
    const { markConfirmation } = await import("@/lib/agent/manager/confirmations");
    await markConfirmation(parsed.data.confirmationId, "CANCELLED");
    return NextResponse.json({
      reply: "Cancelled. No changes were made.",
      blocks: [{ type: "status", kind: "done", message: "Cancelled. No changes were made." }],
    });
  }

  const result = await confirmManagerAction({
    actor: access.actor,
    confirmationId: parsed.data.confirmationId,
  });
  return NextResponse.json(result);
}
