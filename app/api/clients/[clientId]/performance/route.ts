import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !canAccessClient(session.role, session.clientId ?? null, params.clientId)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: snapshots } = await supabase
    .from("performance_snapshots")
    .select("*")
    .eq("client_id", params.clientId)
    .order("week_start", { ascending: false })
    .limit(8);

  return NextResponse.json({ snapshots: snapshots ?? [] });
}
