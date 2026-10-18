import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { loadImportantMessages } from "@/lib/important-messages/feed-service";
import { unreadImportantCount } from "@/lib/important-messages/model";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId || auth.demoGuest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const feed = await loadImportantMessages({
    userId: auth.userId,
    role: auth.role,
    clientId: auth.clientId ?? null,
  });
  if (feed.error) {
    return NextResponse.json({ error: feed.error }, { status: 500 });
  }
  return NextResponse.json({
    items: feed.items,
    unreadCount: unreadImportantCount(feed.items),
    announcementsAvailable: feed.announcementsAvailable,
  });
}
