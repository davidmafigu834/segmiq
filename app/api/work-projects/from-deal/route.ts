import { NextResponse } from "next/server";
import { z } from "zod";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";
import { createWorkProjectFromWonDeal } from "@/lib/work-projects/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  dealId: z.string().uuid(),
  workflowKey: z.enum(["GENERAL_TRADES", "SOLAR_INSTALLATION"]).optional(),
  title: z.string().max(200).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  targetCompletionDate: z.string().nullable().optional(),
  scheduledStartAt: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "A won deal is required." }, { status: 400 });
  const result = await createWorkProjectFromWonDeal(actor, body.data);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data, { status: result.data.created ? 201 : 200 });
}
