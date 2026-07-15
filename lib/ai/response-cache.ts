import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type CacheLookup = {
  cacheKey: string;
  inputHash: string;
  promptVersion: number;
};

type CacheWrite<T> = CacheLookup & {
  feature: string;
  clientId?: string | null;
  leadId?: string | null;
  response: T;
  model: string;
  ttlMs: number;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}

export function hashAiInput(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

export async function getCachedAiResponse<T>({
  cacheKey,
  inputHash,
  promptVersion,
}: CacheLookup): Promise<T | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_response_cache")
    .select("response, input_hash, prompt_version, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error) {
    console.warn("[ai-cache] Cache read failed:", error.message);
    return null;
  }
  if (!data) return null;
  if (data.input_hash !== inputHash) return null;
  if (Number(data.prompt_version) !== promptVersion) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;

  return data.response as T;
}

export async function setCachedAiResponse<T>({
  cacheKey,
  feature,
  clientId = null,
  leadId = null,
  inputHash,
  response,
  model,
  promptVersion,
  ttlMs,
}: CacheWrite<T>): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date();
  const { error } = await supabase.from("ai_response_cache").upsert(
    {
      cache_key: cacheKey,
      feature,
      client_id: clientId,
      lead_id: leadId,
      input_hash: inputHash,
      response,
      model,
      prompt_version: promptVersion,
      generated_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    },
    { onConflict: "cache_key" }
  );

  if (error) {
    console.warn("[ai-cache] Cache write failed:", error.message);
  }
}
