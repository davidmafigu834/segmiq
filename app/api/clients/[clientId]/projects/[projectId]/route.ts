import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function PATCH(req: Request, { params }: { params: { clientId: string; projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;
  const allowed = [
    "title", "category", "location", "completion_date", "description",
    "is_featured", "is_public", "display_order", "duration_label", "budget_range", "show_budget",
    "cover_media_id", "story_brief", "story_result", "pull_quote", "pull_quote_by",
    "timeline_steps", "spec_fields",
  ];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", params.projectId)
    .eq("client_id", params.clientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: { clientId: string; projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.projectId)
    .eq("client_id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
