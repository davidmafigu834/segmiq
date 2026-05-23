import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  await supabase
    .from("client_documents")
    .update({ is_active: false })
    .eq("id", params.documentId)
    .eq("client_id", params.clientId);

  return NextResponse.json({ success: true });
}
