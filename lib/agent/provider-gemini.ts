import type {
  AgentChatMessage,
  AgentModelProvider,
  GenerateRequest,
  ModelResponse,
  ModelToolCall,
} from "./provider";

/**
 * Google Gemini (AI Studio / generativelanguage API).
 * Used for SegmiQ Agent testing on the free Flash tier.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

type GeminiPart = {
  text?: string;
  thought?: boolean;
  functionCall?: { name?: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
    id?: string;
  };
};

type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toGeminiParameters(schema: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  const properties = schema.properties;
  if (!properties || (typeof properties === "object" && Object.keys(properties as object).length === 0)) {
    return undefined;
  }
  return schema;
}

function parseToolResultContent(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed as never };
  } catch {
    return { result: content };
  }
}

function functionNameFromCallId(id: string): string {
  const sep = id.indexOf("::");
  return sep === -1 ? id : id.slice(sep + 2);
}

function geminiCallIdFromCallId(id: string): string | undefined {
  const sep = id.indexOf("::");
  return sep === -1 ? undefined : id.slice(0, sep);
}

function toGeminiContents(messages: AgentChatMessage[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      out.push({ role: "user", parts: [{ text: msg.text }] });
    } else if (msg.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (msg.text?.trim()) parts.push({ text: msg.text });
      for (const call of msg.toolCalls) {
        const nativeId = geminiCallIdFromCallId(call.id);
        parts.push({
          functionCall: {
            name: call.name,
            args: call.input,
            ...(nativeId ? { id: nativeId } : {}),
          },
        });
      }
      if (parts.length) out.push({ role: "model", parts });
    } else {
      out.push({
        role: "user",
        parts: msg.results.map((r) => {
          const nativeId = geminiCallIdFromCallId(r.toolCallId);
          return {
            functionResponse: {
              name: functionNameFromCallId(r.toolCallId),
              response: parseToolResultContent(r.content),
              ...(nativeId ? { id: nativeId } : {}),
            },
          };
        }),
      });
    }
  }
  return out;
}

export class GeminiAgentProvider implements AgentModelProvider {
  readonly modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? getGeminiModel();
  }

  async generate(req: GenerateRequest): Promise<ModelResponse> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const tools = req.tools?.length
      ? [
          {
            functionDeclarations: req.tools.map((t) => {
              const parameters = toGeminiParameters(t.inputSchema);
              return {
                name: t.name,
                description: t.description,
                ...(parameters ? { parameters } : {}),
              };
            }),
          },
        ]
      : undefined;

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: toGeminiContents(req.messages),
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxTokens ?? 2048,
        // Flash thinking tokens eat the free quota and slow tool loops.
        thinkingConfig: { thinkingBudget: 0 },
      },
      ...(tools ? { tools } : {}),
    };

    let lastError: Error | null = null;
    let omitThinking = false;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const payload = omitThinking
        ? {
            ...body,
            generationConfig: {
              temperature: req.temperature ?? 0.2,
              maxOutputTokens: req.maxTokens ?? 2048,
            },
          }
        : body;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(
          `${GEMINI_API_BASE}/${encodeURIComponent(this.modelId)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          if (!omitThinking && response.status === 400 && /thinking/i.test(errText)) {
            omitThinking = true;
            lastError = new Error(`Gemini API ${response.status}: ${errText.slice(0, 300)}`);
            continue;
          }
          if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
            lastError = new Error(`Gemini API ${response.status}: ${errText.slice(0, 300)}`);
            await sleep(750 * Math.pow(2, attempt));
            continue;
          }
          throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 300)}`);
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            content?: { parts?: GeminiPart[] };
            finishReason?: string;
          }>;
          promptFeedback?: { blockReason?: string };
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
          modelVersion?: string;
        };

        if (data.promptFeedback?.blockReason) {
          throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
        }

        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const textParts: string[] = [];
        const toolCalls: ModelToolCall[] = [];
        for (const part of parts) {
          if (part.thought) continue;
          if (part.text?.trim()) textParts.push(part.text);
          if (part.functionCall?.name) {
            const name = part.functionCall.name;
            const geminiId = part.functionCall.id;
            toolCalls.push({
              id: geminiId ? `${geminiId}::${name}` : name,
              name,
              input: part.functionCall.args ?? {},
            });
          }
        }

        const finish = data.candidates?.[0]?.finishReason ?? "";
        return {
          text: textParts.length ? textParts.join("\n").trim() : null,
          toolCalls,
          stopReason: toolCalls.length
            ? "tool_use"
            : finish === "MAX_TOKENS"
              ? "max_tokens"
              : finish === "STOP" || finish === "END_TURN"
                ? "end"
                : "other",
          usage: {
            inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
          },
          model: data.modelVersion ?? this.modelId,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const aborted = lastError.name === "AbortError";
        if (attempt < MAX_RETRIES && (aborted || /fetch failed|network/i.test(lastError.message))) {
          await sleep(750 * Math.pow(2, attempt));
          continue;
        }
        throw aborted ? new Error("Gemini API timeout") : lastError;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("Gemini API call failed");
  }
}
