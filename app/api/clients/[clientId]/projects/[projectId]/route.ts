import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { selectProjectRow } from "@/lib/cloud/project-queries";
import { MAGAZINE_PROJECT_COLUMNS } from "@/lib/cloud/project-columns";

export async function PATCH(req: Request, { params }: { params: { clientId: string; projectId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(auth.role, auth.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;
  const allowed = [
    "title", "category", "location", "completion_date", "description",
    "is_featured", "is_public", "display_order", "duration_label", "budget_range", "show_budget",
    "cover_media_id", "story_brief", "story_result", "pull_quote", "pull_quote_by",
    "timeline_steps", "spec_fields", "include_capability_section",
  ];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = createAdminClient();
  let { error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", params.projectId)
    .eq("client_id", params.clientId)
    .select("id")
    .single();

  if (error?.message?.includes("does not exist")) {
    const magazineKeys = new Set<string>(MAGAZINE_PROJECT_COLUMNS);
    const basePatch = Object.fromEntries(
      Object.entries(patch).filter(([key]) => !magazineKeys.has(key))
    );
    const retry = await supabase
      .from("projects")
      .update(basePatch)
      .eq("id", params.projectId)
      .eq("client_id", params.clientId)
      .select("id")
      .single();
    if (retry.error) {
      return NextResponse.json(
        {
          error:
            "Database migration 065_project_magazine_fields.sql is required for story, specs, and cover fields. Basic project fields were not changed.",
        },
        { status: 500 }
      );
    }
    error = null;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = await selectProjectRow(supabase, params.projectId, params.clientId);
  if (row.error) return NextResponse.json({ error: row.error.message }, { status: 500 });
  return NextResponse.json(row.data);
}

export async function DELETE(req: Request, { params }: { params: { clientId: string; projectId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(auth.role, auth.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Break circular FK: projects.cover_media_id → project_media ← projects (cascade)
  await supabase
    .from("projects")
    .update({ cover_media_id: null, updated_at: new Date().toISOString() })
    .eq("id", params.projectId)
    .eq("client_id", params.clientId);

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.projectId)
    .eq("client_id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
