import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { resetDemoWorkspace } from "@/lib/demo/actions";
import { getWorkspaceConfig } from "@/lib/demo/mode";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.clientId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (auth.role !== "CLIENT_MANAGER" && auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getWorkspaceConfig(auth.clientId);
  if (!config || config.mode !== "demo") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await resetDemoWorkspace(auth.clientId);
  return NextResponse.json({ ok: true });
}
