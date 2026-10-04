import { NextResponse } from "next/server";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";
import { previewWorkProjectFromDeal } from "@/lib/work-projects/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const dealId = new URL(req.url).searchParams.get("dealId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(dealId)) {
    return NextResponse.json({ error: "A won deal is required." }, { status: 400 });
  }
  const result = await previewWorkProjectFromDeal(actor, dealId);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json({ draft: result.data });
}
