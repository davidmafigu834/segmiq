import { NextResponse } from "next/server";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";
import { searchWorkProjectContacts } from "@/lib/work-projects/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const result = await searchWorkProjectContacts(actor, q);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json({ contacts: result.data });
}
