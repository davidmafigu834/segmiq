import type { AgentChatMessage, ModelToolCall } from "./provider";

/**
 * OpenAI Chat Completions message/tool shapes used by Groq and Vercel AI Gateway.
 */

export type OpenAiChatMessage =
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

export type OpenAiToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string | Record<string, unknown> };
};

function toolNameForId(messages: AgentChatMessage[], id: string): string | undefined {
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const hit = msg.toolCalls.find((call) => call.id === id);
    if (hit) return hit.name;
  }
  return undefined;
}

export function toOpenAiChatMessages(messages: AgentChatMessage[]): OpenAiChatMessage[] {
  const out: OpenAiChatMessage[] = [];
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

export function parseOpenAiToolArguments(
  raw: string | Record<string, unknown> | undefined
): Record<string, unknown> {
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

export function textFromOpenAiContent(content: unknown): string | null {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const typed = part as { type?: unknown; thought?: unknown; text?: unknown };
        if (typed.thought === true) return "";
        if (typed.type === "reasoning" || typed.type === "thinking") return "";
        if ("text" in typed) return String(typed.text ?? "");
        return "";
      })
      .join("\n")
      .trim();
    return joined ? joined : null;
  }
  return null;
}

export function mapOpenAiToolCalls(raw: OpenAiToolCall[] | undefined): ModelToolCall[] {
  return (raw ?? [])
    .map((call, index) => {
      const name = call.function?.name?.trim();
      if (!name) return null;
      return {
        id: call.id?.trim() || `${name}_${index}`,
        name,
        input: parseOpenAiToolArguments(call.function?.arguments),
      };
    })
    .filter((call): call is ModelToolCall => Boolean(call));
}

export function openAiStopReason(
  finish: string | undefined,
  toolCalls: ModelToolCall[]
): "end" | "tool_use" | "max_tokens" | "other" {
  if (toolCalls.length) return "tool_use";
  if (finish === "length") return "max_tokens";
  if (finish === "stop" || finish === "end_turn" || finish === "tool_calls") {
    return finish === "tool_calls" ? "tool_use" : "end";
  }
  return "other";
}

export function buildOpenAiChatBody(opts: {
  model: string;
  system: string;
  messages: AgentChatMessage[];
  tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  maxTokens?: number;
  temperature?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1600,
    messages: [{ role: "system", content: opts.system }, ...toOpenAiChatMessages(opts.messages)],
  };
  if (opts.tools?.length) {
    body.tools = opts.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema ?? { type: "object", properties: {} },
      },
    }));
    body.tool_choice = "auto";
  }
  return body;
}
