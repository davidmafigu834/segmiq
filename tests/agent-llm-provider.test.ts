import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  AgentLlmRateLimitError,
  FailoverAgentProvider,
  getAgentLlmFallbackName,
  getAgentLlmProviderName,
  type AgentModelProvider,
  type GenerateRequest,
  type ModelResponse,
} from "../lib/agent/provider";
import { toGroqMessages } from "../lib/agent/provider-groq";

const ENV_KEYS = [
  "AGENT_LLM_PROVIDER",
  "AGENT_LLM_FALLBACK",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "ANTHROPIC_API_KEY",
  "AI_GATEWAY_API_KEY",
  "VERCEL_OIDC_TOKEN",
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function dummyResponse(model: string): ModelResponse {
  return {
    text: `ok from ${model}`,
    toolCalls: [],
    stopReason: "end",
    usage: { inputTokens: 1, outputTokens: 1 },
    model,
  };
}

describe("agent LLM provider selection", () => {
  it("honours AGENT_LLM_PROVIDER=groq", () => {
    setEnv({ AGENT_LLM_PROVIDER: "groq", GROQ_API_KEY: "gsk_test" });
    assert.equal(getAgentLlmProviderName(), "groq");
  });

  it("honours AGENT_LLM_PROVIDER=vercel and the gateway alias", () => {
    setEnv({ AGENT_LLM_PROVIDER: "vercel", AI_GATEWAY_API_KEY: "vck_test" });
    assert.equal(getAgentLlmProviderName(), "vercel");
    setEnv({ AGENT_LLM_PROVIDER: "gateway", AI_GATEWAY_API_KEY: "vck_test" });
    assert.equal(getAgentLlmProviderName(), "vercel");
  });

  it("keeps Gemini as the implicit default when both Gemini and Groq keys exist", () => {
    setEnv({ GEMINI_API_KEY: "gem", GROQ_API_KEY: "gsk" });
    assert.equal(getAgentLlmProviderName(), "gemini");
    assert.equal(getAgentLlmFallbackName(), "groq");
  });

  it("prefers Vercel AI Gateway as Gemini fallback when that key exists", () => {
    setEnv({ GEMINI_API_KEY: "gem", AI_GATEWAY_API_KEY: "vck", GROQ_API_KEY: "gsk" });
    assert.equal(getAgentLlmProviderName(), "gemini");
    assert.equal(getAgentLlmFallbackName(), "vercel");
  });

  it("uses Vercel AI Gateway when it is the only key", () => {
    setEnv({ AI_GATEWAY_API_KEY: "vck" });
    assert.equal(getAgentLlmProviderName(), "vercel");
    assert.equal(getAgentLlmFallbackName(), null);
  });

  it("uses Groq when it is the only free-tier key", () => {
    setEnv({ GROQ_API_KEY: "gsk" });
    assert.equal(getAgentLlmProviderName(), "groq");
    assert.equal(getAgentLlmFallbackName(), null);
  });

  it("disables fallback when AGENT_LLM_FALLBACK=none", () => {
    setEnv({
      AGENT_LLM_PROVIDER: "gemini",
      GEMINI_API_KEY: "gem",
      GROQ_API_KEY: "gsk",
      AGENT_LLM_FALLBACK: "none",
    });
    assert.equal(getAgentLlmFallbackName(), null);
  });
});

describe("Groq message conversion", () => {
  it("maps tool calls and results to OpenAI-compatible Groq messages", () => {
    const mapped = toGroqMessages([
      { role: "user", text: "Need a quote" },
      {
        role: "assistant",
        text: null,
        toolCalls: [{ id: "call_1", name: "catalog_search", input: { query: "panels" } }],
      },
      {
        role: "toolResult",
        results: [{ toolCallId: "call_1", content: "{\"ok\":true}" }],
      },
    ]);
    assert.equal(mapped[0]?.role, "user");
    assert.equal(mapped[1]?.role, "assistant");
    if (mapped[1]?.role !== "assistant") throw new Error("expected assistant");
    assert.equal(mapped[1].tool_calls?.[0]?.function.name, "catalog_search");
    assert.equal(mapped[1].tool_calls?.[0]?.function.arguments, "{\"query\":\"panels\"}");
    assert.equal(mapped[2]?.role, "tool");
    if (mapped[2]?.role !== "tool") throw new Error("expected tool");
    assert.equal(mapped[2].tool_call_id, "call_1");
    assert.equal(mapped[2].name, "catalog_search");
  });
});

describe("LLM failover", () => {
  it("falls over to Groq for a rate-limited call, then tries Gemini again on the next call", async () => {
    let geminiCalls = 0;
    let groqCalls = 0;
    const gemini: AgentModelProvider = {
      modelId: "gemini-3.6-flash",
      async generate() {
        geminiCalls += 1;
        if (geminiCalls === 1) throw new AgentLlmRateLimitError("Gemini API 429");
        return dummyResponse("gemini-3.6-flash");
      },
    };
    const groq: AgentModelProvider = {
      modelId: "openai/gpt-oss-20b",
      async generate() {
        groqCalls += 1;
        return dummyResponse("openai/gpt-oss-20b");
      },
    };
    const provider = new FailoverAgentProvider(gemini, groq, 0);
    const req = { system: "s", messages: [{ role: "user" as const, text: "hi" }] } satisfies GenerateRequest;
    const first = await provider.generate(req);
    const second = await provider.generate(req);
    assert.equal(first.model, "openai/gpt-oss-20b");
    assert.equal(second.model, "gemini-3.6-flash");
    assert.equal(geminiCalls, 2);
    assert.equal(groqCalls, 1);
  });

  it("retries Gemini after Groq is also rate-limited", async () => {
    let geminiCalls = 0;
    const gemini: AgentModelProvider = {
      modelId: "gemini-3.6-flash",
      async generate() {
        geminiCalls += 1;
        if (geminiCalls === 1) throw new AgentLlmRateLimitError("Gemini API 429");
        return dummyResponse("gemini-3.6-flash");
      },
    };
    const groq: AgentModelProvider = {
      modelId: "openai/gpt-oss-20b",
      async generate() {
        throw new AgentLlmRateLimitError("Groq API 429");
      },
    };
    const provider = new FailoverAgentProvider(gemini, groq, 0);
    const result = await provider.generate({
      system: "s",
      messages: [{ role: "user", text: "hi" }],
    });
    assert.equal(result.model, "gemini-3.6-flash");
    assert.equal(geminiCalls, 2);
  });

  it("does not fall back on non-rate-limit errors", async () => {
    const primary: AgentModelProvider = {
      modelId: "gemini-3.6-flash",
      async generate() {
        throw new Error("Gemini API 400: bad request");
      },
    };
    const fallback: AgentModelProvider = {
      modelId: "openai/gpt-oss-20b",
      async generate() {
        return dummyResponse("openai/gpt-oss-20b");
      },
    };
    const provider = new FailoverAgentProvider(primary, fallback);
    await assert.rejects(
      () => provider.generate({ system: "s", messages: [{ role: "user", text: "hi" }] }),
      /400/
    );
  });
});
