import { getAnthropicModel } from "@/lib/ai/claude";
import { GeminiAgentProvider, getGeminiModel } from "./provider-gemini";
import { GroqAgentProvider, getGroqModel } from "./provider-groq";
import type { AgentModelUsage } from "./types";

/**
 * Provider-neutral model abstraction for the agent runtime.
 * Provider-specific response schemas must not leak past this module.
 */

export type AgentToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema for tool input. Deterministic, system-controlled text only. */
  inputSchema: Record<string, unknown>;
};

export type ModelToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

/** Neutral conversation shape used between runtime and provider. */
export type AgentChatMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string | null;
      toolCalls: ModelToolCall[];
      /** Opaque provider payload that must be echoed on the next turn. */
      echo?: unknown;
    }
  | {
      role: "toolResult";
      results: Array<{ toolCallId: string; content: string; isError?: boolean }>;
    };

export type ModelResponse = {
  text: string | null;
  toolCalls: ModelToolCall[];
  stopReason: "end" | "tool_use" | "max_tokens" | "other";
  usage: AgentModelUsage;
  model: string;
  echo?: unknown;
};

export type GenerateRequest = {
  system: string;
  messages: AgentChatMessage[];
  tools?: AgentToolDefinition[];
  maxTokens?: number;
  temperature?: number;
};

export class AgentLlmRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentLlmRateLimitError";
  }
}

export interface AgentModelProvider {
  readonly modelId: string;
  generate(req: GenerateRequest): Promise<ModelResponse>;
}

// ---------------------------------------------------------------------------
// Anthropic implementation (Messages API with tool use).

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type AnthropicMessage = { role: "user" | "assistant"; content: AnthropicContentBlock[] };

function toAnthropicMessages(messages: AgentChatMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      out.push({ role: "user", content: [{ type: "text", text: msg.text }] });
    } else if (msg.role === "assistant") {
      const content: AnthropicContentBlock[] = [];
      if (msg.text?.trim()) content.push({ type: "text", text: msg.text });
      for (const call of msg.toolCalls) {
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      if (content.length) out.push({ role: "assistant", content });
    } else {
      out.push({
        role: "user",
        content: msg.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.toolCallId,
          content: r.content,
          is_error: r.isError || undefined,
        })),
      });
    }
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AnthropicAgentProvider implements AgentModelProvider {
  readonly modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? getAnthropicModel();
  }

  async generate(req: GenerateRequest): Promise<ModelResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body = {
      model: this.modelId,
      max_tokens: req.maxTokens ?? 1500,
      temperature: req.temperature ?? 0.2,
      system: req.system,
      messages: toAnthropicMessages(req.messages),
      ...(req.tools?.length
        ? {
            tools: req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.inputSchema,
            })),
          }
        : {}),
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          // Retry only transient failures; 4xx (except 429) are permanent.
          if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
            lastError = new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
            await sleep(750 * Math.pow(2, attempt));
            continue;
          }
          throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
        }

        const data = (await response.json()) as {
          content: AnthropicContentBlock[];
          stop_reason: string;
          model: string;
          usage?: { input_tokens?: number; output_tokens?: number };
        };

        const textParts: string[] = [];
        const toolCalls: ModelToolCall[] = [];
        for (const block of data.content ?? []) {
          if (block.type === "text") textParts.push(block.text);
          if (block.type === "tool_use") {
            toolCalls.push({ id: block.id, name: block.name, input: block.input ?? {} });
          }
        }

        return {
          text: textParts.length ? textParts.join("\n").trim() : null,
          toolCalls,
          stopReason:
            data.stop_reason === "tool_use"
              ? "tool_use"
              : data.stop_reason === "max_tokens"
                ? "max_tokens"
                : data.stop_reason === "end_turn"
                  ? "end"
                  : "other",
          usage: {
            inputTokens: data.usage?.input_tokens ?? 0,
            outputTokens: data.usage?.output_tokens ?? 0,
          },
          model: data.model ?? this.modelId,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const aborted = lastError.name === "AbortError";
        if (attempt < MAX_RETRIES && (aborted || /fetch failed|network/i.test(lastError.message))) {
          await sleep(750 * Math.pow(2, attempt));
          continue;
        }
        throw aborted ? new Error("Anthropic API timeout") : lastError;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("Anthropic API call failed");
  }
}

export const AGENT_LLM_PROVIDERS = ["gemini", "groq", "anthropic"] as const;
export type AgentLlmProviderName = (typeof AGENT_LLM_PROVIDERS)[number];

export function isAgentLlmRateLimitError(err: unknown): boolean {
  if (err instanceof AgentLlmRateLimitError) return true;
  return err instanceof Error && /\b429\b/.test(err.message);
}

export function isAgentLlmProviderConfigured(name: AgentLlmProviderName): boolean {
  if (name === "gemini") return Boolean(process.env.GEMINI_API_KEY?.trim());
  if (name === "groq") return Boolean(process.env.GROQ_API_KEY?.trim());
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function getAgentLlmProviderName(): AgentLlmProviderName {
  const explicit = process.env.AGENT_LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === "gemini" || explicit === "groq" || explicit === "anthropic") return explicit;
  if (process.env.GEMINI_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim()) {
    return "gemini";
  }
  if (process.env.GROQ_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim()) {
    return "groq";
  }
  return "anthropic";
}

/**
 * Secondary provider used when the primary returns HTTP 429.
 * Default: Groq if Gemini is primary (or Gemini if Groq is primary), when that key exists.
 * Set AGENT_LLM_FALLBACK=none to disable.
 */
export function getAgentLlmFallbackName(): AgentLlmProviderName | null {
  const primary = getAgentLlmProviderName();
  const raw = process.env.AGENT_LLM_FALLBACK?.trim().toLowerCase();
  if (raw === "none" || raw === "off" || raw === "false") return null;

  let fallback: AgentLlmProviderName | null = null;
  if (raw === "gemini" || raw === "groq" || raw === "anthropic") {
    fallback = raw;
  } else if (primary === "gemini" && isAgentLlmProviderConfigured("groq")) {
    fallback = "groq";
  } else if (primary === "groq" && isAgentLlmProviderConfigured("gemini")) {
    fallback = "gemini";
  }

  if (!fallback || fallback === primary) return null;
  if (!isAgentLlmProviderConfigured(fallback)) return null;
  return fallback;
}

export function createAgentModelProvider(name: AgentLlmProviderName): AgentModelProvider {
  if (name === "gemini") return new GeminiAgentProvider();
  if (name === "groq") return new GroqAgentProvider();
  return new AnthropicAgentProvider();
}

export function describeAgentLlm(): {
  provider: AgentLlmProviderName;
  fallback: AgentLlmProviderName | null;
  model: string;
} {
  const provider = getAgentLlmProviderName();
  const model =
    provider === "gemini" ? getGeminiModel() : provider === "groq" ? getGroqModel() : getAnthropicModel();
  return { provider, fallback: getAgentLlmFallbackName(), model };
}

/**
 * Tries the primary provider, then sticks to the fallback for the rest of this
 * instance (one agent run) after a rate-limit error.
 */
export class FailoverAgentProvider implements AgentModelProvider {
  private usingFallback = false;

  constructor(
    private readonly primary: AgentModelProvider,
    private readonly fallback: AgentModelProvider
  ) {}

  get modelId(): string {
    return this.usingFallback ? this.fallback.modelId : this.primary.modelId;
  }

  async generate(req: GenerateRequest): Promise<ModelResponse> {
    if (this.usingFallback) {
      return this.fallback.generate(req);
    }
    try {
      return await this.primary.generate(req);
    } catch (err) {
      if (!isAgentLlmRateLimitError(err)) throw err;
      this.usingFallback = true;
      const message = err instanceof Error ? err.message : String(err);
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: "agent",
          event: "llm.fallback",
          from: this.primary.modelId,
          to: this.fallback.modelId,
          reason: message.slice(0, 240),
        })
      );
      return this.fallback.generate(req);
    }
  }
}

export function getAgentModelProvider(): AgentModelProvider {
  const primary = createAgentModelProvider(getAgentLlmProviderName());
  const fallbackName = getAgentLlmFallbackName();
  if (!fallbackName) return primary;
  return new FailoverAgentProvider(primary, createAgentModelProvider(fallbackName));
}
