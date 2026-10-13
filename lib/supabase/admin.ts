import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getGuestContext } from "@/lib/demo/context";
import { assertDemoDatabaseAllowed } from "@/lib/demo/deployment";
import { DemoAccessDenied } from "@/lib/demo/errors";
import { assertGuestRepositoryAccess } from "@/lib/demo/repository-guard";

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

function guardGuestAdminClient(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          assertGuestRepositoryAccess(table);
          return target.from(table);
        };
      }
      if (prop === "rpc" || prop === "storage" || prop === "auth") {
        const denied = () => {
          throw new DemoAccessDenied();
        };
        return new Proxy(denied, {
          get() {
            throw new DemoAccessDenied();
          },
        });
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function createAdminClient(): SupabaseClient {
  assertDemoDatabaseAllowed();
  const client = rawAdminClient();
  if (getGuestContext()) return guardGuestAdminClient(client);
  return client;
}

/**
 * Service-role client with no guest table guard.
 * Only the pinned demo-workspace lookup may use this while a guest context is active.
 */
export function createUnguardedAdminClient(): SupabaseClient {
  assertDemoDatabaseAllowed();
  return rawAdminClient();
}

function rawAdminClient(): SupabaseClient {
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
