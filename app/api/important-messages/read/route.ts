import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { markImportantMessagesRead } from "@/lib/important-messages/feed-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  notificationIds: z.array(z.string().uuid()).max(40).optional(),
  announcementIds: z.array(z.string().uuid()).max(40).optional(),
});

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId || auth.demoGuest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = await markImportantMessagesRead({
    userId: auth.userId,
    notificationIds: parsed.data.notificationIds ?? [],
    announcementIds: parsed.data.announcementIds ?? [],
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
