import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProjectPdfFilename,
  generateProjectPdfKey,
  normalizeAppDomainUrl,
} from "@/lib/cloud/project-magazine";
import { isMissingMagazineColumnError } from "@/lib/cloud/project-columns";
import { renderProjectPdf } from "@/lib/cloud/render-project-pdf";
import { getPublicUrl, putObject } from "@/lib/storage/r2";

export type GenerateProjectPdfResult = {
  pdfUrl: string;
  pdfGeneratedAt: string;
  filename: string;
  buffer: Buffer;
};

export async function generateAndStoreProjectPdf(opts: {
  clientId: string;
  projectId: string;
  slug: string;
  title: string;
  updatedAt: string;
}): Promise<GenerateProjectPdfResult> {
  const { clientId, projectId, slug, title, updatedAt } = opts;
  const baseUrl = normalizeAppDomainUrl();
  const printUrl = `${baseUrl}/p/${slug}/projects/${projectId}/print`;
  const filename = buildProjectPdfFilename(title || "case-study");

  const pdfBuffer = await renderProjectPdf(printUrl);
  const key = generateProjectPdfKey(clientId, projectId);
  await putObject(key, pdfBuffer, "application/pdf", {
    contentDisposition: `attachment; filename="${filename}"`,
    cacheControl: "public, max-age=31536000, immutable",
  });
  const publicPdfUrl = getPublicUrl(key);
  const now = new Date().toISOString();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projects")
    .update({
      pdf_url: publicPdfUrl,
      pdf_generated_at: now,
      updated_at: updatedAt,
    })
    .eq("id", projectId)
    .eq("client_id", clientId);

  if (error) {
    if (!isMissingMagazineColumnError(error.message)) {
      throw new Error(error.message);
    }
    console.warn("[project pdf] pdf_url columns missing — apply migration 065");
  }

  return {
    pdfUrl: publicPdfUrl,
    pdfGeneratedAt: now,
    filename,
    buffer: pdfBuffer,
  };
}
