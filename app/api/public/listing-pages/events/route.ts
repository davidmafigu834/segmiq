import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { checkDbRateLimit } from "@/lib/auth/db-rate-limit";
import { createHash } from "crypto";
import { clientIpFromRequest } from "@/lib/auth/user-sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordPublicSignal } from "@/lib/real-estate/agent-listing-pages/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  token: z.string().regex(/^[A-Za-z0-9_-]{32,80}$/).nullable().optional(),
  eventType: z.enum(["engaged_view", "whatsapp_click"]),
});

export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: origin.status });
  const raw = await req.text();
  if (raw.length > 2000) return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 413 });
  let json: unknown = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 });
  const ip = clientIpFromRequest(req) ?? "unknown";
  const ipKey = createHash("sha256").update(`${process.env.NEXTAUTH_SECRET ?? "listing"}:${ip}`).digest("hex").slice(0, 24);
  const limited = await checkDbRateLimit({ key: `listing-page:event:${ipKey}`, limit: 60, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  const result = await recordPublicSignal(createAdminClient(), {
    slug: parsed.data.slug,
    token: parsed.data.token ?? null,
    eventType: parsed.data.eventType,
    userAgent: req.headers.get("user-agent"),
    visitor: cookies().get("sq_lp")?.value ?? null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true, recorded: parsed.data.eventType, whatsappMessageSent: false, leadCreated: false });
}
