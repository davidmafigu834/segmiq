import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Cap hung PostgREST/Auth calls so serverless routes fail fast instead of burning maxDuration. */
export const ADMIN_FETCH_TIMEOUT_MS = 12_000;

let cached: SupabaseClient | null = null;

function withAdminFetchTimeout(existing: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!existing) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([existing, timeout]);
  }
  return timeout;
}

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js caches fetch() in Server Components by default; without this,
    // admin GETs (e.g. clients list) can stay stale after inserts.
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: withAdminFetchTimeout(init?.signal, ADMIN_FETCH_TIMEOUT_MS),
        }),
    },
  });
  return cached;
}
