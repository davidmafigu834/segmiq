import { NextResponse } from "next/server";
import { z } from "zod";
import { workProjectActor } from "@/lib/work-projects/http";
import { canManageWorkProjects } from "@/lib/work-projects/access";
import { getPortalSettings, portalUsage, savePortalSettings, type PortalSettings } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean(),
  showProjectFinancials: z.boolean(),
  allowPaymentProofUpload: z.boolean(),
  showAssets: z.boolean(),
  showSerialNumbers: z.boolean(),
  showWarranties: z.boolean(),
  allowSupport: z.boolean(),
  allowUpgradeRequests: z.boolean(),
  portalAiEnabled: z.boolean(),
});

export async function GET(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor?.clientId || !canManageWorkProjects(actor, actor.clientId)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  const [settings, usage] = await Promise.all([getPortalSettings(actor.clientId), portalUsage(actor.clientId)]);
  return NextResponse.json({ settings, usage });
}

export async function POST(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor?.clientId || !canManageWorkProjects(actor, actor.clientId)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the portal settings." }, { status: 400 });
  const result = await savePortalSettings(actor.clientId, body.data as PortalSettings);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ settings: result.settings });
}
