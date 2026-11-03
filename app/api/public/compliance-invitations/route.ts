import { NextResponse } from "next/server";
import { detectComplianceFileType } from "@/lib/real-estate/compliance";
import { publicInvitationAction } from "@/lib/real-estate/compliance-management/service";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? "local").trim().slice(0, 80);
}

function sessionCookie(req: Request): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const part = raw.split(";").map((item) => item.trim()).find((item) => item.startsWith("sq_cv="));
  return part ? decodeURIComponent(part.slice("sq_cv=".length)) : null;
}

type PublicInviteAction = "preview" | "send_code" | "verify" | "save" | "submit";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let token = "";
  let action: PublicInviteAction = "preview";
  let code: string | null = null;
  let fields: Record<string, unknown> = {};
  const files: Array<{ requirementKey: string; filename: string; contentType: string; bytes: Buffer }> = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    token = String(form.get("token") ?? "");
    action = String(form.get("action") ?? "submit") as PublicInviteAction;
    const rawFields = String(form.get("fields") ?? "{}");
    try { fields = JSON.parse(rawFields) as Record<string, unknown>; } catch { fields = {}; }
    for (const [key, value] of form.entries()) {
      if (!(value instanceof File) || !key.startsWith("file:")) continue;
      const bytes = Buffer.from(await value.arrayBuffer());
      const detected = detectComplianceFileType(bytes);
      if (!detected) return NextResponse.json({ error: "Upload a PDF or image." }, { status: 400 });
      files.push({ requirementKey: key.slice(5), filename: value.name, contentType: detected, bytes });
    }
  } else {
    const body = await req.json().catch(() => null) as { token?: string; action?: PublicInviteAction; code?: string; fields?: Record<string, unknown> } | null;
    token = body?.token ?? "";
    action = body?.action ?? "preview";
    code = body?.code ?? null;
    fields = body?.fields ?? {};
  }

  if (!token || token.length < 20) return NextResponse.json({ error: "This request is not available." }, { status: 404 });
  const result = await publicInvitationAction({
    token,
    action,
    code,
    sessionId: sessionCookie(req),
    fields,
    files,
    ip: clientIp(req),
  });
  if ("ok" in result && result.ok === false) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  const record = (result ?? {}) as { sessionId?: unknown };
  const sessionId = typeof record.sessionId === "string" ? record.sessionId : null;
  const responseBody = sessionId ? { ...record, sessionId: undefined } : result;
  const response = NextResponse.json(responseBody, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  if (sessionId) {
    response.cookies.set("sq_cv", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/verify",
      maxAge: 60 * 30,
    });
  }
  return response;
}
