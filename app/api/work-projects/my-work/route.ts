import { NextResponse } from "next/server";
import { listMyWork } from "@/lib/work-projects/field-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const result = await listMyWork(actor);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
