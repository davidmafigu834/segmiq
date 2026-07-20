import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedJourneysForClient } from "@/lib/marketing/journeys/seed";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  await seedJourneysForClient(params.clientId);

  const supabase = createAdminClient();
  const { data: journeys, error } = await supabase
    .from("marketing_journeys")
    .select("*")
    .eq("client_id", params.clientId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ journeys: journeys ?? [] });
}
