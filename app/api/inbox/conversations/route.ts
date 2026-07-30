import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-guards";
import { fetchInboxConversations } from "@/lib/inbox/fetch-conversations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;

  const { session } = g;
  if (
    session.role !== "SALESPERSON" &&
    session.role !== "CLIENT_MANAGER" &&
    session.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const clientId =
    session.role === "SUPER_ADMIN"
      ? url.searchParams.get("clientId") ?? session.clientId
      : session.clientId;

  if (!clientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }

  const conversations = await fetchInboxConversations({
    role: session.role,
    userId: session.userId,
    clientId,
    alsoSells: session.alsoSells,
  });

  return NextResponse.json({ conversations });
}
