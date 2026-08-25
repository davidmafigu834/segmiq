import { NextResponse } from "next/server";
import { requireCompanyBrainManager } from "@/lib/company-brain/access";
import { recordBrainAudit } from "@/lib/company-brain/audit";
import { brainCollections } from "@/lib/company-brain/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireCompanyBrainManager(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const item = await brainCollections.updateKnowledge(access.clientId, params.id, {
      status: "APPROVED",
      approved_by_id: access.userId,
      approved_at: new Date().toISOString(),
      last_reviewed_at: new Date().toISOString(),
    });
    await recordBrainAudit({
      clientId: access.clientId,
      actorId: access.userId,
      action: "KNOWLEDGE_APPROVED",
      entityType: "knowledge",
      entityId: params.id,
      summary: `Approved knowledge document "${item.title}"`,
    });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
