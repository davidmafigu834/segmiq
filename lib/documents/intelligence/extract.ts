import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { listDocumentTypes } from "@/lib/documents/service";
import { extractIntelligenceWithLlm } from "@/lib/documents/intelligence/llm-extract";
import { persistDocumentIntelligence } from "@/lib/documents/intelligence/store";
import { classifyHeuristically } from "@/lib/documents/classification/heuristics";
import type { IntelligenceExtractionResult } from "@/lib/documents/intelligence/types";

async function resolveDocumentTypeCode(
  clientId: string,
  documentTypeId: string | null
): Promise<string> {
  if (!documentTypeId) return "OTHER";
  const types = await listDocumentTypes(clientId);
  return types.find((t) => t.id === documentTypeId)?.code ?? "OTHER";
}

export async function extractDocumentIntelligence(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  filename: string;
  title: string;
  plainText: string;
  documentTypeId?: string | null;
  documentTypeCode?: string | null;
}): Promise<{
  applied: boolean;
  result: IntelligenceExtractionResult | null;
  documentTypeCode: string;
}> {
  const settings = await loadDocumentCompanySettings(opts.clientId);
  const documentTypeCode =
    opts.documentTypeCode ??
    (await resolveDocumentTypeCode(opts.clientId, opts.documentTypeId ?? null));

  if (!settings.analyze_automatically || !opts.plainText.trim()) {
    return { applied: false, result: null, documentTypeCode };
  }

  let result = await extractIntelligenceWithLlm({
    filename: opts.filename,
    title: opts.title,
    documentTypeCode,
    textSample: opts.plainText,
  });

  if (!result) {
    const heuristic = classifyHeuristically({
      filename: opts.filename,
      textSample: opts.plainText,
    });
    result = {
      summary: null,
      purpose: null,
      detectedLanguage: null,
      extractionConfidence: "LOW",
      facts: [],
      obligations: [],
      importantDates: [],
      model: "heuristic-fallback",
    };
    if (heuristic.suggestedCategoryName) {
      result.summary = `Detected ${heuristic.documentTypeCode.replace(/_/g, " ").toLowerCase()} document. Full intelligence extraction requires sufficient readable text.`;
    }
  }

  if (!settings.extract_key_terms) {
    result.facts = [];
  }
  if (!settings.extract_obligations) {
    result.obligations = [];
  }

  await persistDocumentIntelligence({
    clientId: opts.clientId,
    documentId: opts.documentId,
    versionId: opts.versionId,
    documentTypeCode,
    result,
  });

  return { applied: true, result, documentTypeCode };
}
