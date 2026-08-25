import {
  AgentLlmRateLimitError,
  type AgentChatMessage,
  type AgentModelProvider,
  type GenerateRequest,
  type ModelResponse,
  type ModelToolCall,
} from "./provider";

/**
 * Groq Cloud (OpenAI-compatible Chat Completions).
 * Free developer-plan option for SegmiQ Agent when Gemini is rate-limited.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

export type GroqChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

type GroqToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string | Record<string, unknown> };
};

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response, attempt: number, errText: string): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.ceil(seconds * 1000) + 250, 20_000);
    }
  }
  const match = errText.match(/try again in ([\d.]+)\s*s/i);
  if (match) {
    return Math.min(Math.ceil(Number(match[1]) * 1000) + 400, 20_000);
  }
  return Math.min(1_500 * Math.pow(2, attempt), 12_000);
}

function parseToolArguments(raw: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed as never };
  } catch {
    return {};
  }
}

function toolNameForId(messages: AgentChatMessage[], id: string): string | undefined {
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const hit = msg.toolCalls.find((call) => call.id === id);
    if (hit) return hit.name;
  }
  return undefined;
}

export function toGroqMessages(messages: AgentChatMessage[]): GroqChatMessage[] {
  const out: GroqChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      out.push({ role: "user", content: msg.text });
    } else if (msg.role === "assistant") {
      const toolCalls = msg.toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: JSON.stringify(call.input ?? {}) },
      }));
      out.push({
        role: "assistant",
        content: msg.text?.trim() ? msg.text : null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
    } else {
      for (const result of msg.results) {
        const name = toolNameForId(messages, result.toolCallId);
        out.push({
          role: "tool",
          tool_call_id: result.toolCallId,
          ...(name ? { name } : {}),
          content: result.content,
        });
      }
    }
  }
  return out;
}

function textFromContent(content: unknown): string | null {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("\n")
      .trim();
    return joined ? joined : null;
  }
  return null;
}

export class GroqAgentProvider implements AgentModelProvider {
  readonly modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? getGroqModel();
  }

  async generate(req: GenerateRequest): Promise<ModelResponse> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

    const body: Record<string, unknown> = {
      model: this.modelId,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 1600,
      messages: [{ role: "system", content: req.system }, ...toGroqMessages(req.messages)],
    };
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema ?? { type: "object", properties: {} },
        },
      }));
      body.tool_choice = "auto";
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          if (response.status === 429) {
            lastError = new AgentLlmRateLimitError(`Groq API 429: ${errText.slice(0, 400)}`);
            if (attempt < MAX_RETRIES) {
              await sleep(retryAfterMs(response, attempt, errText));
              continue;
            }
            throw lastError;
          }
          if ((response.status === 408 || response.status >= 500) && attempt < MAX_RETRIES) {
            lastError = new Error(`Groq API ${response.status}: ${errText.slice(0, 400)}`);
            await sleep(750 * Math.pow(2, attempt));
            continue;
          }
          throw new Error(`Groq API ${response.status}: ${errText.slice(0, 400)}`);
        }

        const data = (await response.json()) as {
          model?: string;
          choices?: Array<{
            finish_reason?: string;
            message?: {
              content?: unknown;
              tool_calls?: GroqToolCall[];
            };
          }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const choice = data.choices?.[0];
        const message = choice?.message;
        const toolCalls: ModelToolCall[] = (message?.tool_calls ?? [])
          .map((call, index) => {
            const name = call.function?.name?.trim();
            if (!name) return null;
            return {
              id: call.id?.trim() || `${name}_${index}`,
              name,
              input: parseToolArguments(call.function?.arguments),
            };
          })
          .filter((call): call is ModelToolCall => Boolean(call));

        const finish = choice?.finish_reason ?? "";
        return {
          text: textFromContent(message?.content),
          toolCalls,
          stopReason: toolCalls.length
            ? "tool_use"
            : finish === "length"
              ? "max_tokens"
              : finish === "stop" || finish === "end_turn"
                ? "end"
                : "other",
          usage: {
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
          },
          model: data.model ?? this.modelId,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError instanceof AgentLlmRateLimitError && attempt >= MAX_RETRIES) throw lastError;
        const aborted = lastError.name === "AbortError";
        if (attempt < MAX_RETRIES && (aborted || /fetch failed|network/i.test(lastError.message))) {
          await sleep(750 * Math.pow(2, attempt));
          continue;
        }
        throw aborted ? new Error("Groq API timeout") : lastError;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("Groq API call failed");
  }
}
