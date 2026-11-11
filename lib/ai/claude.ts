const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

type ContentBlock = { type: string; text?: string; name?: string; input?: unknown };

export type ClaudeUserBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export function getAnthropicModel(env: Record<string, string | undefined> = process.env): string {
  return env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

export async function callClaude({
  system,
  userMessage,
  maxTokens = 500,
}: {
  system: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getAnthropicModel(),
      max_tokens: maxTokens,
      system,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = (await response.json()) as { content: ContentBlock[] };
  const text = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");

  return text.trim();
}

/**
 * Same Claude client as the other product features, with an image or PDF and a tool
 * so the model returns one JSON object. Uses ANTHROPIC_API_KEY and ANTHROPIC_MODEL.
 */
export async function callClaudeStructured({
  system,
  content,
  tool,
  maxTokens = 2500,
  model,
  env = process.env,
  fetchImpl = fetch,
}: {
  system: string;
  content: ClaudeUserBlock[];
  tool: { name: string; description: string; inputSchema: Record<string, unknown> };
  maxTokens?: number;
  model?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; input: unknown; model: string } | { ok: false; error: string }> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY is not configured" };
  const chosen = model?.trim() || getAnthropicModel(env);
  let response: Response;
  try {
    response = await fetchImpl(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: chosen,
        max_tokens: maxTokens,
        temperature: 0,
        system,
        tools: [{ name: tool.name, description: tool.description, input_schema: tool.inputSchema }],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return { ok: false, error: message };
  }
  const payload = (await response.json().catch(() => null)) as { content?: ContentBlock[]; error?: { message?: string } } | null;
  if (!response.ok) return { ok: false, error: payload?.error?.message || `Claude API error ${response.status}` };
  const used = payload?.content?.find((block) => block.type === "tool_use" && block.name === tool.name);
  if (used?.input && typeof used.input === "object") return { ok: true, input: used.input, model: chosen };
  const text = payload?.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("").trim();
  if (!text) return { ok: false, error: "Claude returned an empty response." };
  try {
    return { ok: true, input: JSON.parse(text), model: chosen };
  } catch {
    return { ok: false, error: "Claude did not return JSON." };
  }
}
