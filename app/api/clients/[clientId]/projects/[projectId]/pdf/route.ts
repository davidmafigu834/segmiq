import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndStoreProjectPdf } from "@/lib/cloud/generate-project-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Force-regenerate the case-study PDF for a project (dashboard). */
export async function POST(
  req: Request,
  { params }: { params: { clientId: string; projectId: string } }
) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(auth.role, auth.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, client_id, title, updated_at, is_public")
    .eq("id", params.projectId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.is_public) {
    return NextResponse.json(
      { error: "Make this project public before generating a PDF." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("slug, is_published")
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (!profile?.slug || !profile.is_published) {
    return NextResponse.json(
      { error: "Publish your public profile before generating a PDF." },
      { status: 400 }
    );
  }

  try {
    const result = await generateAndStoreProjectPdf({
      clientId: params.clientId,
      projectId: params.projectId,
      slug: profile.slug as string,
      title: (project.title as string) || "case-study",
      updatedAt: project.updated_at as string,
    });

    return NextResponse.json({
      pdf_url: result.pdfUrl,
      pdf_generated_at: result.pdfGeneratedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
