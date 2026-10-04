import { NextResponse } from "next/server";
import { z } from "zod";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";
import { addWorkProjectNote } from "@/lib/work-projects/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  content: z.string().min(1).max(4000),
});

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Write a note." }, { status: 400 });
  const result = await addWorkProjectNote(actor, params.projectId, body.data.content);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
