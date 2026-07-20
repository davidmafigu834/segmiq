import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { fetchMarketingOverview } from "@/lib/marketing/overview";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  try {
    const overview = await fetchMarketingOverview(params.clientId);
    return NextResponse.json({ overview });
  } catch (e) {
    console.error("[marketing overview]", e);
    const msg = e instanceof Error ? e.message : String(e);
    const missingTable = msg.includes("does not exist") || msg.includes("whatsapp_campaigns");
    return NextResponse.json(
      {
        error: missingTable
          ? "Marketing Hub tables are not migrated yet. Run migrations 075–078 on Supabase."
          : "Failed to load marketing overview",
        details: msg,
      },
      { status: missingTable ? 503 : 500 }
    );
  }
}
