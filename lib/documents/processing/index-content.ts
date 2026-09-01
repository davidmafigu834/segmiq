import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/company-brain/chunks";
import type { ExtractionResult } from "@/lib/documents/processing/types";
import { DOCUMENT_EXTRACTOR_VERSION } from "@/lib/documents/processing/constants";

export async function persistExtraction(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  result: ExtractionResult;
}): Promise<{ chunkCount: number }> {
  const supabase = createAdminClient();
  const { charCount, wordCount } = {
    charCount: opts.result.plainText.length,
    wordCount: opts.result.plainText.trim() ? opts.result.plainText.trim().split(/\s+/).length : 0,
  };

  await supabase.from("document_version_content").upsert(
    {
      version_id: opts.versionId,
      client_id: opts.clientId,
      document_id: opts.documentId,
      plain_text: opts.result.plainText || null,
      pages: opts.result.pages,
      tables: opts.result.tables,
      char_count: charCount,
      word_count: wordCount,
      extractor_version: DOCUMENT_EXTRACTOR_VERSION,
      extracted_at: new Date().toISOString(),
    },
    { onConflict: "version_id" }
  );

  await supabase.from("document_chunks").delete().eq("version_id", opts.versionId);

  const chunks = buildChunks(opts.result);
  if (chunks.length) {
    await supabase.from("document_chunks").insert(
      chunks.map((chunk, index) => ({
        client_id: opts.clientId,
        document_id: opts.documentId,
        version_id: opts.versionId,
        chunk_index: index,
        content: chunk.content,
        page_number: chunk.pageNumber ?? null,
        section_heading: chunk.sectionHeading ?? null,
        metadata: chunk.metadata ?? {},
      }))
    );
  }

  return { chunkCount: chunks.length };
}

function buildChunks(result: ExtractionResult): Array<{
  content: string;
  pageNumber?: number;
  sectionHeading?: string;
  metadata?: Record<string, unknown>;
}> {
  const out: Array<{
    content: string;
    pageNumber?: number;
    sectionHeading?: string;
    metadata?: Record<string, unknown>;
  }> = [];

  for (const table of result.tables) {
    const header = table.rows[0]?.join(" | ") ?? "";
    const body = table.rows
      .slice(1)
      .map((r) => r.join(" | "))
      .join("\n");
    const content = `[Table: ${table.label}]\n${header}\n${body}`.trim();
    if (content.length > 20) {
      out.push({
        content,
        pageNumber: table.pageNumber,
        sectionHeading: table.label,
        metadata: { kind: "table", tableId: table.id },
      });
    }
  }

  if (result.pages.length) {
    for (const page of result.pages) {
      const pageChunks = chunkText(page.text, 900, 90);
      pageChunks.forEach((content, i) => {
        out.push({
          content,
          pageNumber: page.pageNumber,
          sectionHeading: pageChunks.length > 1 ? `Page ${page.pageNumber} (part ${i + 1})` : `Page ${page.pageNumber}`,
          metadata: { kind: "page_text" },
        });
      });
    }
  } else if (result.plainText) {
    chunkText(result.plainText, 900, 90).forEach((content, i) => {
      out.push({
        content,
        metadata: { kind: "plain_text", part: i + 1 },
      });
    });
  }

  return out.slice(0, 120);
}
