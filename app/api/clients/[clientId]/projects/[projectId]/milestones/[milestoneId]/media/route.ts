import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; projectId: string; milestoneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { mediaIds } = await req.json() as { mediaIds?: string[] };

  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return NextResponse.json({ error: "mediaIds array required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("project_media")
    .update({ milestone_id: params.milestoneId })
    .in("id", mediaIds)
    .eq("project_id", params.projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: { clientId: string; projectId: string; milestoneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { mediaIds } = await req.json() as { mediaIds?: string[] };

  const supabase = createAdminClient();

  if (Array.isArray(mediaIds) && mediaIds.length > 0) {
    const { error } = await supabase
      .from("project_media")
      .update({ milestone_id: null })
      .in("id", mediaIds)
      .eq("milestone_id", params.milestoneId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("project_media")
      .update({ milestone_id: null })
      .eq("milestone_id", params.milestoneId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
