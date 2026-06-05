import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { syncRetargetingForClient } from "@/lib/retargeting";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canAccessClient(session.role, session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  await supabase.from("retargeting_audience_state").upsert(
    {
      client_id: params.clientId,
      ad_live_at: now,
      ad_live_by: session.userId,
      updated_at: now,
    },
    { onConflict: "client_id" }
  );

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", params.clientId)
    .single();

  const status = await syncRetargetingForClient(
    params.clientId,
    (client?.name as string) ?? "Client"
  );

  return NextResponse.json({ ok: true, status });
}
