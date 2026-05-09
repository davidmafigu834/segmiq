import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string; projectId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .select(`
      id,
      title,
      description,
      milestone_date,
      display_order,
      is_completed,
      created_at,
      project_media (
        id,
        public_url,
        caption,
        display_order,
        file_size_bytes,
        milestone_id
      )
    `)
    .eq("project_id", params.projectId)
    .eq("client_id", params.clientId)
    .order("milestone_date", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestones: data });
}

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; projectId: string } }
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
  };
  const { title, description, milestone_date, display_order } = body;

  if (!title || !milestone_date) {
    return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .insert({
      project_id: params.projectId,
      client_id: params.clientId,
      title,
      description: description ?? null,
      milestone_date,
      display_order: display_order ?? 0,
      is_completed: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestone: data });
}
