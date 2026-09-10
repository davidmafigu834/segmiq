import { createAdminClient } from "@/lib/supabase/admin";
import { checkSecurityRateLimit } from "@/lib/auth/security-rate-limit";

/**
 * Fixed-window rate limit backed by `security_rate_limits`.
 * Falls back to in-memory buckets if the DB write path fails.
 */
export async function checkDbRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const key = opts.key.slice(0, 512);
  try {
    const supabase = createAdminClient();
    const now = Date.now();
    const { data, error } = await supabase
      .from("security_rate_limits")
      .select("count, window_start")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      return checkSecurityRateLimit(opts);
    }

    const windowStartMs = data?.window_start ? new Date(data.window_start).getTime() : 0;
    const expired = !data || windowStartMs + opts.windowMs <= now;

    if (expired) {
      const { error: upsertErr } = await supabase.from("security_rate_limits").upsert(
        {
          key,
          count: 1,
          window_start: new Date(now).toISOString(),
        },
        { onConflict: "key" }
      );
      if (upsertErr) return checkSecurityRateLimit(opts);
      return { ok: true };
    }

    const count = Number(data.count ?? 0);
    if (count >= opts.limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((windowStartMs + opts.windowMs - now) / 1000)),
      };
    }

    const { error: updateErr } = await supabase
      .from("security_rate_limits")
      .update({ count: count + 1 })
      .eq("key", key);
    if (updateErr) return checkSecurityRateLimit(opts);
    return { ok: true };
  } catch {
    return checkSecurityRateLimit(opts);
  }
}
