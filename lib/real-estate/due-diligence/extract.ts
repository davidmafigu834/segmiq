import { z } from "zod";
import { callClaudeStructured, getAnthropicModel, type ClaudeUserBlock } from "@/lib/ai/claude";
import { generateGeminiDocument, getGeminiModel } from "@/lib/agent/provider-gemini";
import { generateGatewayDocument, getVercelGatewayApiKey, getVercelGatewayModel } from "@/lib/agent/provider-gateway";
import { getGroqChatUrl, getGroqModel } from "@/lib/agent/provider-groq";
import { generateJsonChat } from "@/lib/agent/openai-chat";
import { EXTRACTION_JSON_SCHEMA, EXTRACTION_SYSTEM_PROMPT, extractionUserText } from "@/lib/real-estate/due-diligence/prompts";
import { DOCUMENT_TYPES, type DocumentExtraction, type DocumentType } from "@/lib/real-estate/due-diligence/types";

const extractionSchema = z.object({
  document_type: z.enum([...DOCUMENT_TYPES, "unknown"]),
  confidence: z.number().min(0).max(1),
  quality: z.enum(["readable", "poor", "suspicious"]),
  quality_notes: z.string(),
  red_flags: z.array(z.string()),
  fields: z.object({
    full_name: z.string().nullable(),
    other_names: z.array(z.string()),
    id_number: z.string().nullable(),
    date_of_birth: z.string().nullable(),
    property_description: z.string().nullable(),
    stand_number: z.string().nullable(),
    suburb: z.string().nullable(),
    city: z.string().nullable(),
    deed_number: z.string().nullable(),
    local_authority: z.string().nullable(),
    issue_date: z.string().nullable(),
    expiry_date: z.string().nullable(),
    developer_name: z.string().nullable(),
    permit_number: z.string().nullable(),
    agreement_number: z.string().nullable(),
    restrictions: z.array(z.string()),
  }),
});

export type ExtractionRequest = {
  declaredType: DocumentType;
  fileName: string;
  contentType: string;
  bytes: Buffer;
};

export type ExtractionFailure = { ok: false; error: string };
export type ExtractionSuccess = { ok: true; extraction: DocumentExtraction; model: string };

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function toExtraction(parsed: z.infer<typeof extractionSchema>): DocumentExtraction {
  const fields = parsed.fields;
  return {
    documentType: parsed.document_type,
    confidence: parsed.confidence,
    quality: parsed.quality,
    qualityNotes: parsed.quality_notes.trim(),
    redFlags: parsed.red_flags.map((flag) => flag.trim()).filter(Boolean),
    fields: {
      fullName: blankToNull(fields.full_name),
      otherNames: fields.other_names.map((name) => name.trim()).filter(Boolean),
      idNumber: blankToNull(fields.id_number),
      dateOfBirth: blankToNull(fields.date_of_birth),
      propertyDescription: blankToNull(fields.property_description),
      standNumber: blankToNull(fields.stand_number),
      suburb: blankToNull(fields.suburb),
      city: blankToNull(fields.city),
      deedNumber: blankToNull(fields.deed_number),
      localAuthority: blankToNull(fields.local_authority),
      issueDate: blankToNull(fields.issue_date),
      expiryDate: blankToNull(fields.expiry_date),
      developerName: blankToNull(fields.developer_name),
      permitNumber: blankToNull(fields.permit_number),
      agreementNumber: blankToNull(fields.agreement_number),
      restrictions: fields.restrictions.map((item) => item.trim()).filter(Boolean),
    },
  };
}

async function pdfText(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  const parsed = await parser.getText();
  return (parsed.text ?? "").replace(/\s+/g, " ").trim().slice(0, 12000);
}

function filePart(request: ExtractionRequest, textFallback: string | null) {
  if (request.contentType.startsWith("image/")) {
    const encoded = request.bytes.toString("base64");
    return {
      kind: "vision" as const,
      content: [
        { type: "text", text: extractionUserText(request.declaredType, request.fileName) },
        { type: "image_url", image_url: { url: `data:${request.contentType};base64,${encoded}`, detail: "high" } },
      ],
    };
  }
  if (request.contentType === "application/pdf" && !textFallback) {
    const encoded = request.bytes.toString("base64");
    return {
      kind: "file" as const,
      content: [
        { type: "text", text: extractionUserText(request.declaredType, request.fileName) },
        { type: "file", file: { filename: request.fileName || "document.pdf", file_data: `data:application/pdf;base64,${encoded}` } },
      ],
    };
  }
  return {
    kind: "text" as const,
    content: [
      {
        type: "text",
        text: `${extractionUserText(request.declaredType, request.fileName)}\n\nText extracted from the PDF:\n${textFallback || "No text could be extracted. Say quality is poor and leave fields null."}`,
      },
    ],
  };
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

async function complete(args: {
  apiKey: string;
  model: string;
  content: unknown;
  fetchImpl: typeof fetch;
}): Promise<{ ok: true; content: string } | ExtractionFailure> {
  const response = await args.fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: { name: "zw_property_document", strict: true, schema: EXTRACTION_JSON_SCHEMA },
      },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: args.content },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = (await response.json().catch(() => null)) as ChatResponse | null;
  if (!response.ok) {
    return { ok: false, error: payload?.error?.message || `The document reader returned ${response.status}.` };
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return { ok: false, error: "The document reader returned an empty response." };
  return { ok: true, content };
}

type PlatformReader = { provider: "anthropic" | "gemini" | "groq" | "vercel" | "openai"; apiKey: string; model: string };

function configuredProvider(env: Record<string, string | undefined>): PlatformReader["provider"] | null {
  const choice = env.DUE_DILIGENCE_PROVIDER?.trim().toLowerCase();
  if (choice === "openai" || choice === "gemini" || choice === "groq" || choice === "vercel" || choice === "anthropic") return choice;
  if (choice === "claude") return "anthropic";
  const agent = env.AGENT_LLM_PROVIDER?.trim().toLowerCase();
  if (agent === "gateway" || agent === "ai-gateway") return "vercel";
  if (agent === "gemini" || agent === "groq" || agent === "vercel" || agent === "anthropic") return agent;
  if (env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim()) return "vercel";
  if (env.GEMINI_API_KEY?.trim()) return "gemini";
  if (env.GROQ_API_KEY?.trim()) return "groq";
  if (env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

function readerFor(env: Record<string, string | undefined>): PlatformReader | null {
  const provider = configuredProvider(env);
  if (!provider) return null;
  if (provider === "vercel") {
    const apiKey = getVercelGatewayApiKey(env);
    if (!apiKey) return null;
    return { provider, apiKey, model: getVercelGatewayModel(env) };
  }
  if (provider === "groq") {
    const apiKey = env.GROQ_API_KEY?.trim() || "";
    if (!apiKey) return null;
    return { provider, apiKey, model: getGroqModel(env) };
  }
  if (provider === "gemini") {
    const apiKey = env.GEMINI_API_KEY?.trim() || "";
    if (!apiKey) return null;
    return { provider, apiKey, model: env.GEMINI_MODEL?.trim() || getGeminiModel() };
  }
  if (provider === "anthropic") {
    const apiKey = env.ANTHROPIC_API_KEY?.trim() || "";
    if (!apiKey) return null;
    const model = env.DUE_DILIGENCE_MODEL?.trim().startsWith("claude")
      ? env.DUE_DILIGENCE_MODEL.trim()
      : getAnthropicModel(env);
    return { provider, apiKey, model };
  }
  const apiKey = env.OPENAI_API_KEY?.trim() || "";
  if (!apiKey) return null;
  const model = env.DUE_DILIGENCE_MODEL?.trim() && !env.DUE_DILIGENCE_MODEL.trim().startsWith("claude")
    ? env.DUE_DILIGENCE_MODEL.trim()
    : "gpt-4o";
  return { provider: "openai", apiKey, model };
}

function claudeParts(request: ExtractionRequest, textFallback: string | null): ClaudeUserBlock[] {
  const instruction = extractionUserText(request.declaredType, request.fileName);
  const encoded = request.bytes.toString("base64");
  if (request.contentType.startsWith("image/")) {
    return [
      { type: "image", source: { type: "base64", media_type: request.contentType, data: encoded } },
      { type: "text", text: instruction },
    ];
  }
  if (request.contentType === "application/pdf" && !textFallback) {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: encoded } },
      { type: "text", text: instruction },
    ];
  }
  return [{
    type: "text",
    text: `${instruction}\n\nText extracted from the PDF:\n${textFallback || "No text could be extracted. Say quality is poor and leave fields null."}`,
  }];
}

function geminiParts(request: ExtractionRequest, textFallback: string | null) {
  const instruction = extractionUserText(request.declaredType, request.fileName);
  const encoded = request.bytes.toString("base64");
  if (request.contentType.startsWith("image/") && !textFallback) {
    return [
      { inlineData: { mimeType: request.contentType, data: encoded } },
      { text: instruction },
    ];
  }
  if (request.contentType === "application/pdf" && !textFallback) {
    return [
      { inlineData: { mimeType: "application/pdf", data: encoded } },
      { text: instruction },
    ];
  }
  return [{
    text: `${instruction}\n\nText extracted from the PDF:\n${textFallback || "No text could be extracted. Say quality is poor and leave fields null."}`,
  }];
}

function chatUserContent(request: ExtractionRequest, textFallback: string | null): string | Array<Record<string, unknown>> {
  const instruction = `${extractionUserText(request.declaredType, request.fileName)}\n\nReturn one JSON object with exactly these keys:\n${JSON.stringify(EXTRACTION_JSON_SCHEMA)}`;
  if (request.contentType.startsWith("image/")) {
    return [
      { type: "text", text: instruction },
      { type: "image_url", image_url: { url: `data:${request.contentType};base64,${request.bytes.toString("base64")}` } },
    ];
  }
  return `${instruction}\n\nText extracted from the PDF:\n${textFallback || "No text could be extracted. Say quality is poor and leave fields null."}`;
}

function parsedExtraction(json: unknown, model: string): ExtractionSuccess | ExtractionFailure {
  const parsed = extractionSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "The document reader returned an unexpected shape." };
  return { ok: true, extraction: toExtraction(parsed.data), model };
}

const RECORD_TOOL = {
  name: "record_document",
  description: "Record the structured reading of one Zimbabwe property document.",
  inputSchema: EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
};

/**
 * Reads one uploaded file with the AI this deployment is configured to use.
 * That is AGENT_LLM_PROVIDER when it is set, otherwise the gateway, Gemini, Groq, or Claude key that is present.
 * Images are sent to the model. PDFs go through as files for Claude and Gemini, and as extracted text for the gateway and Groq.
 * A missing key is a normal result: the rules still run on the declared types.
 */
export async function extractDocument(
  request: ExtractionRequest,
  options: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {}
): Promise<ExtractionSuccess | ExtractionFailure> {
  const env = options.env ?? process.env;
  const reader = readerFor(env);
  if (!reader) return { ok: false, error: "No platform AI is configured. Set AGENT_LLM_PROVIDER and its API key." };
  const fetchImpl = options.fetchImpl ?? fetch;
  if (reader.provider === "anthropic") {
    const first = await callClaudeStructured({
      system: EXTRACTION_SYSTEM_PROMPT,
      content: claudeParts(request, null),
      tool: RECORD_TOOL,
      model: reader.model,
      env,
      fetchImpl,
    });
    if (!first.ok && request.contentType === "application/pdf") {
      const text = await pdfText(request.bytes).catch(() => "");
      const fallback = await callClaudeStructured({
        system: EXTRACTION_SYSTEM_PROMPT,
        content: claudeParts(request, text),
        tool: RECORD_TOOL,
        model: reader.model,
        env,
        fetchImpl,
      });
      if (!fallback.ok) return fallback;
      return parsedExtraction(fallback.input, fallback.model);
    }
    if (!first.ok) return first;
    return parsedExtraction(first.input, first.model);
  }
  if (reader.provider === "gemini") {
    const first = await generateGeminiDocument({
      apiKey: reader.apiKey,
      model: reader.model,
      system: EXTRACTION_SYSTEM_PROMPT,
      parts: geminiParts(request, null),
      responseSchema: EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
      fetchImpl,
    });
    if (!first.ok && request.contentType === "application/pdf") {
      const text = await pdfText(request.bytes).catch(() => "");
      const fallback = await generateGeminiDocument({
        apiKey: reader.apiKey,
        model: reader.model,
        system: EXTRACTION_SYSTEM_PROMPT,
        parts: geminiParts(request, text),
        responseSchema: EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
        fetchImpl,
      });
      if (!fallback.ok) return fallback;
      return parsedExtraction(fallback.json, fallback.model);
    }
    if (!first.ok) return first;
    return parsedExtraction(first.json, first.model);
  }
  if (reader.provider === "vercel" || reader.provider === "groq") {
    const text = request.contentType === "application/pdf" ? await pdfText(request.bytes).catch(() => "") : null;
    const userContent = chatUserContent(request, text);
    const result = reader.provider === "vercel"
      ? await generateGatewayDocument({ env, system: EXTRACTION_SYSTEM_PROMPT, userContent, fetchImpl })
      : await generateJsonChat({
          url: getGroqChatUrl(),
          apiKey: reader.apiKey,
          model: reader.model,
          system: EXTRACTION_SYSTEM_PROMPT,
          userContent,
          fetchImpl,
          extra: /gpt-oss/i.test(reader.model) ? { reasoning_format: "hidden", reasoning_effort: "low" } : undefined,
        });
    if (!result.ok) return result;
    return parsedExtraction(result.json, result.model);
  }
  const firstPart = filePart(request, null);
  let result = await complete({ apiKey: reader.apiKey, model: reader.model, content: firstPart.content, fetchImpl });
  if (!result.ok && firstPart.kind === "file") {
    const text = await pdfText(request.bytes).catch(() => "");
    const fallback = filePart(request, text);
    result = await complete({ apiKey: reader.apiKey, model: reader.model, content: fallback.content, fetchImpl });
  }
  if (!result.ok) return result;
  let json: unknown;
  try {
    json = JSON.parse(result.content);
  } catch {
    return { ok: false, error: "The document reader did not return JSON." };
  }
  return parsedExtraction(json, reader.model);
}
