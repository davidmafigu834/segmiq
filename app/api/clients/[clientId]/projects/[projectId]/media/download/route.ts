import { PassThrough } from "node:stream";
import { NextResponse } from "next/server";
import type { Archiver } from "archiver";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import {
  buildPhotoDownloadFilename,
  buildProjectPhotosZipFilename,
  getPublishablePhotoKey,
} from "@/lib/cloud/project-media-download";
import { getObject } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PhotoRow = {
  id: string;
  storage_key: string;
  caption: string | null;
  display_order: number;
};

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string; projectId: string } }
) {
  const auth = await resolveApiAuth(_req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessClient(auth.role, auth.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const [{ data: project, error: projectError }, { data: mediaItems, error: mediaError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("title")
        .eq("id", params.projectId)
        .eq("client_id", params.clientId)
        .maybeSingle(),
      supabase
        .from("project_media")
        .select("id, storage_key, caption, display_order, type")
        .eq("project_id", params.projectId)
        .eq("client_id", params.clientId)
        .neq("type", "video")
        .order("display_order", { ascending: true }),
    ]);

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const photos = (mediaItems ?? []) as PhotoRow[];
  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos to download." }, { status: 400 });
  }

  const projectTitle = (project.title as string) ?? "project";
  const zipName = buildProjectPhotosZipFilename(projectTitle);
  const passThrough = new PassThrough();
  // archiver is CJS; require keeps types simple in this route handler.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const createArchive = require("archiver") as (
    format: string,
    options?: { zlib?: { level?: number } }
  ) => Archiver;
  const archive = createArchive("zip", { zlib: { level: 5 } });

  archive.on("error", (err: Error) => {
    passThrough.destroy(err);
  });

  archive.pipe(passThrough);

  void (async () => {
    try {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]!;
        const publishKey = getPublishablePhotoKey(photo.storage_key);
        const buffer = await getObject(publishKey);
        archive.append(buffer, {
          name: buildPhotoDownloadFilename(projectTitle, i, photo.caption),
        });
      }
      await archive.finalize();
    } catch (err) {
      archive.abort();
      passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  const webStream = new ReadableStream({
    start(controller) {
      passThrough.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      passThrough.on("end", () => controller.close());
      passThrough.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName.replace(/["\\]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
