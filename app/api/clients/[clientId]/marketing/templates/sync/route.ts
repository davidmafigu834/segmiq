import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { syncTemplateStatuses, listLocalTemplates } from "@/lib/marketing/template-manager";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const synced = await syncTemplateStatuses(params.clientId);
  const templates = await listLocalTemplates(params.clientId);
  return NextResponse.json({ synced, templates });
}
