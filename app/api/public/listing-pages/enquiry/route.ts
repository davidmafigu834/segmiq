import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { clientIpFromRequest } from "@/lib/auth/user-sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitPublicForm } from "@/lib/real-estate/agent-listing-pages/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  token: z.string().regex(/^[A-Za-z0-9_-]{32,80}$/).nullable().optional(),
  name: z.string().max(120),
  phone: z.string().max(40),
  message: z.string().max(2000).nullable().optional(),
  contactMethod: z.enum(["phone", "whatsapp", "either"]).nullable().optional(),
  companyWebsiteConfirm: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: origin.status });
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 415 });
  }
  const raw = await req.text();
  if (raw.length > 8000) return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Check the form and try again", code: "INVALID_REQUEST" }, { status: 400 });
  if (parsed.data.companyWebsiteConfirm) return NextResponse.json({ error: "Could not send the enquiry", code: "REJECTED" }, { status: 400 });
  const ip = clientIpFromRequest(req) ?? "unknown";
  const ipKey = createHash("sha256").update(`${process.env.NEXTAUTH_SECRET ?? "listing"}:${ip}`).digest("hex").slice(0, 32);
  const result = await submitPublicForm(createAdminClient(), {
    slug: parsed.data.slug,
    token: parsed.data.token ?? null,
    kind: "enquiry",
    name: parsed.data.name,
    phone: parsed.data.phone,
    message: parsed.data.message ?? null,
    preferredAt: null,
    contactMethod: parsed.data.contactMethod ?? null,
    idempotencyKey: req.headers.get("idempotency-key"),
    ipKey,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    message: `Thank you. Your enquiry has been sent to ${result.agencyName}.`,
    viewingConfirmed: false,
  });
}
