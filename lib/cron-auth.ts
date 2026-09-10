import { timingSafeEqual } from "crypto";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set.
 * External schedulers should use the same header. In development, auth is skipped.
 *
 * SECURITY: constant-time compare; missing CRON_SECRET in production denies all.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const raw = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim() ?? "";
  if (!raw) return false;

  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
