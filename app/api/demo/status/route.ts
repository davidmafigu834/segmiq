import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { getGuestContext } from "@/lib/demo/context";
import { getWorkspaceConfig } from "@/lib/demo/mode";
import { demoPersonasForTemplate } from "@/lib/demo/personas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.clientId) return NextResponse.json({ demo: false, name: null, canReset: false });

  const config = await getWorkspaceConfig(auth.clientId);
  const demo = config?.mode === "demo";
  const guest = Boolean(auth.demoGuest && getGuestContext());
  const canReset = demo && !guest && (auth.role === "CLIENT_MANAGER" || auth.role === "SUPER_ADMIN");
  return NextResponse.json(
    {
      demo,
      name: demo ? config?.name ?? null : null,
      canReset,
      guest,
      fictional: guest,
      personaKey: guest ? getGuestContext()?.personaKey ?? null : null,
      personas: guest ? demoPersonasForTemplate(config?.industry ?? null, config?.scenario ?? null) : [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
