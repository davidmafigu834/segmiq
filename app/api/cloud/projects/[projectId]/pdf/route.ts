import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProjectPdfFilename,
  generateProjectPdfKey,
  isProjectPdfCacheFresh,
  normalizeAppDomainUrl,
} from "@/lib/cloud/project-magazine";
import { renderProjectPdf } from "@/lib/cloud/render-project-pdf";
import { getPublicUrl, putObject } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pdfAttachmentResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug query parameter is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("client_id, slug, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (!profile?.is_published) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const clientId = profile.client_id as string;

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, client_id, title, pdf_url, pdf_generated_at, updated_at, is_public")
    .eq("id", params.projectId)
    .eq("client_id", clientId)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = buildProjectPdfFilename((project.title as string) || "case-study");
  const pdfUrl = (project.pdf_url as string | null) ?? null;
  const updatedAt = project.updated_at as string;

  if (
    isProjectPdfCacheFresh({
      pdf_url: pdfUrl,
      pdf_generated_at: (project.pdf_generated_at as string | null) ?? null,
      updated_at: updatedAt,
    }) &&
    pdfUrl
  ) {
    return NextResponse.redirect(pdfUrl, { status: 302 });
  }

  const baseUrl = normalizeAppDomainUrl();
  const printUrl = `${baseUrl}/p/${slug}/projects/${params.projectId}/print`;

  try {
    const pdfBuffer = await renderProjectPdf(printUrl);
    const key = generateProjectPdfKey(clientId, params.projectId);
    await putObject(key, pdfBuffer, "application/pdf", {
      contentDisposition: `attachment; filename="${filename}"`,
      cacheControl: "public, max-age=31536000, immutable",
    });
    const publicPdfUrl = getPublicUrl(key);
    const now = new Date().toISOString();

    await supabase
      .from("projects")
      .update({
        pdf_url: publicPdfUrl,
        pdf_generated_at: now,
        updated_at: updatedAt,
      })
      .eq("id", params.projectId)
      .eq("client_id", clientId);

    return pdfAttachmentResponse(pdfBuffer, filename);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
