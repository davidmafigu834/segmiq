import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShareLink } from "@/lib/real-estate/agent-listing-pages/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string; shareId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  const result = await getShareLink(
    createAdminClient(),
    { userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId, alsoSells: guard.session.alsoSells },
    params.clientId,
    params.shareId
  );
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  const share = result.share;
  const url = typeof share.publicUrl === "string" ? share.publicUrl : null;
  if (!url || share?.status !== "active") return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  const png = await QRCode.toBuffer(url, { width: 480, margin: 1, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
}
