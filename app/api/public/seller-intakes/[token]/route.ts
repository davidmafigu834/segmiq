import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { checkDbRateLimit } from "@/lib/auth/db-rate-limit";
import { sellerIntakeEnabled } from "@/lib/real-estate/seller-intake/flag";
import { rejectClientScanStatus } from "@/lib/real-estate/seller-intake/scan";
import { publicSellerIntake, savePublicSellerIntake } from "@/lib/real-estate/seller-intake/service";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  answers: z.record(z.string(), z.string()).optional(),
  version: z.number().int().nullable().optional(),
  submit: z.boolean().optional(),
}).strict();

function rateBucket(action: string, token: string) {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 12);
  return `seller-intake-${action}:${digest}`;
}

function sessionToken(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(/(?:^|;\s*)sq_si=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function withSession(body: unknown, token: string | null) {
  const response = NextResponse.json(body);
  if (token) {
    response.cookies.set("sq_si", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 14 * 24 * 60 * 60,
    });
  }
  return response;
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  if (!sellerIntakeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const limited = await checkDbRateLimit({ key: rateBucket("read", params.token), limit: 60, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "Try again shortly." }, { status: 429 });
  const result = await publicSellerIntake({ token: params.token, sessionToken: sessionToken(req) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ version: result.version, status: result.status, form: result.form });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!sellerIntakeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
  const limited = await checkDbRateLimit({ key: rateBucket("write", params.token), limit: 30, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "Try again shortly." }, { status: 429 });
  const raw = await req.json().catch(() => null);
  if (rejectClientScanStatus(raw)) return NextResponse.json({ error: "Scan status cannot be set by a request." }, { status: 400 });
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const result = await savePublicSellerIntake({
    token: params.token,
    sessionToken: sessionToken(req),
    answers: parsed.data.answers ?? {},
    version: parsed.data.version ?? null,
    submit: Boolean(parsed.data.submit),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return withSession({ version: result.version, status: result.status, idempotent: result.idempotent }, result.sessionToken);
}
