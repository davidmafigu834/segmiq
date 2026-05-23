const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type ContentBlock = { type: string; text?: string };

export async function callClaude({
  system,
  userMessage,
  maxTokens = 500,
}: {
  system: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
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
