import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { canPublishAnnouncements, safeInternalPath } from "@/lib/important-messages/model";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const writeSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(3).max(280),
  body: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(["whats_new", "notice"]),
  audience: z.enum(["all", "industry", "role", "organisation"]),
  industry: z.string().trim().max(40).optional().nullable(),
  roleTarget: z.enum(["CLIENT_MANAGER", "SALESPERSON"]).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  href: z.string().trim().max(240).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  action: z.enum(["draft", "publish", "archive"]),
});

function unavailable(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "42P01" || /schema cache|does not exist/i.test(message);
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId || !canPublishAnnouncements(auth.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await createAdminClient()
    .from("platform_announcements")
    .select("id, title, summary, body, category, audience, industry, role_target, client_id, href, status, published_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (unavailable(rows.error)) {
    return NextResponse.json({ error: "Announcements are waiting for the database update.", items: [] }, { status: 503 });
  }
  if (rows.error) return NextResponse.json({ error: "Could not load announcements." }, { status: 500 });
  return NextResponse.json({ items: rows.data ?? [] });
}

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId || !canPublishAnnouncements(auth.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = writeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid announcement" }, { status: 400 });
  const input = parsed.data;
  const href = input.href ? safeInternalPath(input.href) : null;
  if (input.href && !href) return NextResponse.json({ error: "Destination must be a SegmiQ path." }, { status: 400 });
  if (input.audience === "industry" && !input.industry) {
    return NextResponse.json({ error: "Choose an industry for this audience." }, { status: 400 });
  }
  if (input.audience === "role" && !input.roleTarget) {
    return NextResponse.json({ error: "Choose a role for this audience." }, { status: 400 });
  }
  if (input.audience === "organisation" && !input.clientId) {
    return NextResponse.json({ error: "Choose an organisation for this audience." }, { status: 400 });
  }

  const status = input.action === "publish" ? "published" : input.action === "archive" ? "archived" : "draft";
  const row = {
    title: input.title,
    summary: input.summary,
    body: input.body ?? null,
    category: input.category,
    audience: input.audience,
    industry: input.audience === "industry" ? input.industry : null,
    role_target: input.audience === "role" ? input.roleTarget : null,
    client_id: input.audience === "organisation" ? input.clientId : null,
    href,
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
    expires_at: input.expiresAt ?? null,
    created_by: auth.userId,
    updated_at: new Date().toISOString(),
  };
  const supabase = createAdminClient();
  const write = input.id
    ? await supabase.from("platform_announcements").update(row).eq("id", input.id).select("id, status").single()
    : await supabase.from("platform_announcements").insert(row).select("id, status").single();
  if (unavailable(write.error)) {
    return NextResponse.json({ error: "Announcements are waiting for the database update." }, { status: 503 });
  }
  if (write.error || !write.data) return NextResponse.json({ error: "Could not save the announcement." }, { status: 500 });
  return NextResponse.json({ id: write.data.id, status: write.data.status });
}
