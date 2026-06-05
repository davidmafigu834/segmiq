import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { syncRetargetingForClient } from "@/lib/retargeting";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessClient(session.role, session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", params.clientId)
    .maybeSingle();

  const status = await syncRetargetingForClient(
    params.clientId,
    (client?.name as string) ?? "Client"
  );

  return NextResponse.json(status);
}
