import { PassThrough } from "node:stream";
import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import {
  buildPhotoDownloadFilename,
  buildProjectPhotosZipFilename,
  fetchPublishablePhotoBuffer,
} from "@/lib/cloud/project-media-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PhotoRow = {
  id: string;
  storage_key: string;
  caption: string | null;
  display_order: number;
};

async function buildProjectPhotosZip(projectTitle: string, photos: PhotoRow[]): Promise<Buffer> {
  const { ZipArchive } = await import("archiver");
  const archive = new ZipArchive({ zlib: { level: 5 } });
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);
    archive.on("error", reject);

    void (async () => {
      try {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i]!;
          const buffer = await fetchPublishablePhotoBuffer(photo.storage_key);
          archive.append(buffer, {
            name: buildPhotoDownloadFilename(projectTitle, i, photo.caption),
          });
        }
        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    })();
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string; projectId: string } }
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
    const zipBuffer = await buildProjectPhotosZip(projectTitle, photos);

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName.replace(/["\\]/g, "")}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[media/download zip]", err);
    return NextResponse.json({ error: "Could not prepare download." }, { status: 500 });
  }
}
