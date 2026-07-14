import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_QUICK_REPLIES } from "@/lib/inbox/quick-reply-vars";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireSession();
  if ("error" in g) return g.error;

  const { session } = g;
  if (!session.clientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("whatsapp_quick_replies")
    .select("id, title, body, user_id, display_order")
    .eq("client_id", session.clientId)
    .eq("is_active", true)
    .or(`user_id.is.null,user_id.eq.${session.userId}`)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("whatsapp_quick_replies")) {
      return NextResponse.json({
        replies: DEFAULT_QUICK_REPLIES.map((r, i) => ({
          id: `default-${i}`,
          title: r.title,
          body: r.body,
          isDefault: true,
        })),
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const replies = (rows ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    isDefault: false,
  }));

  if (!replies.length) {
    return NextResponse.json({
      replies: DEFAULT_QUICK_REPLIES.map((r, i) => ({
        id: `default-${i}`,
        title: r.title,
        body: r.body,
        isDefault: true,
      })),
    });
  }

  return NextResponse.json({ replies });
}

const postSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;

  const { session } = g;
  if (!session.clientId || session.role !== "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_quick_replies")
    .insert({
      client_id: session.clientId,
      user_id: session.userId,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
    })
    .select("id, title, body")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reply: {
      id: data.id as string,
      title: data.title as string,
      body: data.body as string,
      isDefault: false,
    },
  });
}
