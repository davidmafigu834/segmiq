import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import {
  buildPhotoDownloadFilename,
  fetchPublishablePhotoBuffer,
} from "@/lib/cloud/project-media-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string; projectId: string; mediaId: string } }
) {
  try {
    const auth = await resolveApiAuth(_req);
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessClient(auth.role, auth.clientId, params.clientId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data: media, error } = await supabase
      .from("project_media")
      .select("id, storage_key, caption, type, display_order, project_id")
      .eq("id", params.mediaId)
      .eq("project_id", params.projectId)
      .eq("client_id", params.clientId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!media) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    const row = media as {
      storage_key: string;
      caption: string | null;
      type: string;
      display_order: number;
    };

    if (row.type === "video") {
      return NextResponse.json({ error: "Video downloads are not supported here." }, { status: 400 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("title")
      .eq("id", params.projectId)
      .eq("client_id", params.clientId)
      .maybeSingle();

    const projectTitle = (project?.title as string | undefined) ?? "project";
    const filename = buildPhotoDownloadFilename(projectTitle, row.display_order, row.caption);
    const buffer = await fetchPublishablePhotoBuffer(row.storage_key);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${filename.replace(/["\\]/g, "")}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[media/download]", err);
    return NextResponse.json({ error: "Could not prepare download." }, { status: 500 });
  }
}
