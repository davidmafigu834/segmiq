import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject } from "@/lib/storage/r2";
import { canAccessClient } from "@/lib/auth/permissions";

export async function PATCH(req: Request, { params }: { params: { clientId: string; projectId: string; mediaId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { caption?: string; display_order?: number };
  const patch: Record<string, unknown> = {};
  if ("caption" in body) patch.caption = body.caption;
  if ("display_order" in body) patch.display_order = body.display_order;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_media")
    .update(patch)
    .eq("id", params.mediaId)
    .eq("project_id", params.projectId)
    .eq("client_id", params.clientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: { clientId: string; projectId: string; mediaId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: media } = await supabase
    .from("project_media")
    .select("storage_key")
    .eq("id", params.mediaId)
    .maybeSingle();

  const storageKey = (media as { storage_key?: string } | null)?.storage_key;

  const { error } = await supabase
    .from("project_media")
    .delete()
    .eq("id", params.mediaId)
    .eq("project_id", params.projectId)
    .eq("client_id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("projects")
    .update({ cover_media_id: null, updated_at: new Date().toISOString() })
    .eq("id", params.projectId)
    .eq("client_id", params.clientId)
    .eq("cover_media_id", params.mediaId);

  if (storageKey) {
    try { await deleteObject(storageKey); } catch { /* non-fatal */ }
  }

  return new NextResponse(null, { status: 204 });
}
