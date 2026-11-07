import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { sellerIntakeEnabled } from "@/lib/real-estate/seller-intake/flag";
import { buildSellerRecord, sellerRecordFilename } from "@/lib/real-estate/seller-intake/record";
import { renderSellerRecordPdf } from "@/lib/real-estate/seller-intake/record-pdf";
import { loadSellerIntakeRecord, type IntakeActor } from "@/lib/real-estate/seller-intake/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string; requestId: string } }) {
  if (!sellerIntakeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  const actor: IntakeActor = {
    id: guard.session.userId,
    name: guard.session.user?.name ?? "Agent",
    role: guard.session.role,
    clientId: guard.session.clientId,
  };
  const loaded = await loadSellerIntakeRecord({ clientId: params.clientId, requestId: params.requestId, actor });
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const record = buildSellerRecord(loaded);
  const bytes = await renderSellerRecordPdf(record);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${sellerRecordFilename(record.sellerName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
