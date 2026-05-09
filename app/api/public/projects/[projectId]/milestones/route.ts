import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, is_public")
    .eq("id", params.projectId)
    .single();

  if (!project || !project.is_public) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("project_milestones")
    .select(`
      id,
      title,
      description,
      milestone_date,
      display_order,
      is_completed,
      project_media (
        id,
        public_url,
        caption,
        display_order
      )
    `)
    .eq("project_id", params.projectId)
    .order("milestone_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestones: data });
}
