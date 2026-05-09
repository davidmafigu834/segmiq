import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; projectId: string; milestoneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    title?: string;
    description?: string;
    milestone_date?: string;
    display_order?: number;
    is_completed?: boolean;
  };
  const { title, description, milestone_date, display_order, is_completed } = body;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .update({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(milestone_date !== undefined && { milestone_date }),
      ...(display_order !== undefined && { display_order }),
      ...(is_completed !== undefined && { is_completed }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.milestoneId)
    .eq("client_id", params.clientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestone: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; projectId: string; milestoneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  await supabase
    .from("project_media")
    .update({ milestone_id: null })
    .eq("milestone_id", params.milestoneId);

  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", params.milestoneId)
    .eq("client_id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
