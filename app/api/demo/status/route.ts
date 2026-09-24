import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { getWorkspaceConfig } from "@/lib/demo/mode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.clientId) return NextResponse.json({ demo: false, name: null, canReset: false });

  const config = await getWorkspaceConfig(auth.clientId);
  const demo = config?.mode === "demo";
  const canReset = demo && (auth.role === "CLIENT_MANAGER" || auth.role === "SUPER_ADMIN");
  return NextResponse.json({
    demo,
    name: demo ? config?.name ?? null : null,
    canReset,
  });
}
