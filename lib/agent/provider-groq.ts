import {
  AgentLlmRateLimitError,
  type AgentModelProvider,
  type GenerateRequest,
  type ModelResponse,
} from "./provider";
import {
  buildOpenAiChatBody,
  mapOpenAiToolCalls,
  openAiStopReason,
  textFromOpenAiContent,
  toOpenAiChatMessages,
  type OpenAiChatMessage,
  type OpenAiToolCall,
} from "./openai-chat";

/**
 * Groq Cloud (OpenAI-compatible Chat Completions).
 * Free developer-plan option for SegmiQ Agent when Gemini is rate-limited.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

export type GroqChatMessage = OpenAiChatMessage;
export const toGroqMessages = toOpenAiChatMessages;

export function getGroqModel(env: Record<string, string | undefined> = process.env): string {
  return env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function getGroqChatUrl(): string {
  return GROQ_API_URL;
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

export class GroqAgentProvider implements AgentModelProvider {
  readonly modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? getGroqModel();
  }

  async generate(req: GenerateRequest): Promise<ModelResponse> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

    const body = buildOpenAiChatBody({
      model: this.modelId,
      system: req.system,
      messages: req.messages,
      tools: req.tools,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
    });
    // gpt-oss puts a long chain-of-thought in `content` unless reasoning is hidden,
    // which then blows the token budget before the required JSON is emitted.
    if (/gpt-oss/i.test(this.modelId)) {
      body.reasoning_format = "hidden";
      body.reasoning_effort = "low";
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
              tool_calls?: OpenAiToolCall[];
            };
          }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const choice = data.choices?.[0];
        const message = choice?.message;
        const toolCalls = mapOpenAiToolCalls(message?.tool_calls);

        return {
          text: textFromOpenAiContent(message?.content),
          toolCalls,
          stopReason: openAiStopReason(choice?.finish_reason, toolCalls),
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
