import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: { clientId: string; recommendationId: string } }
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
  const body = await req.json() as { status?: string };
  const { status } = body;

  if (!status || !["dismissed", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "dismissed") {
    updateData.dismissed_at = new Date().toISOString();
  } else if (status === "resolved") {
    updateData.resolved_at = new Date().toISOString();
  }

  await supabase
    .from("client_recommendations")
    .update(updateData)
    .eq("id", params.recommendationId)
    .eq("client_id", params.clientId);

  return NextResponse.json({ success: true });
}
