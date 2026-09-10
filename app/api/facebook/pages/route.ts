import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { graphCall } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { loadClientFbGraphTokens } from "@/lib/facebook/client-tokens";

export async function GET(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const { pageToken, userToken } = await loadClientFbGraphTokens(clientId);
  // /me/accounts needs the user token when a page token is stored in fb_access_token.
  const token = userToken || pageToken;
  if (!token) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const fields = encodeURIComponent("id,name,access_token");
  const result = await graphCall<{ data?: { id: string; name: string; access_token?: string }[] }>(
    `/me/accounts?fields=${fields}`,
    token,
    { clientId }
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message, tokenExpired: result.tokenExpired },
      { status: 502 }
    );
  }

  const rows = result.data.data ?? [];

  fbLog("fb.page.listed", { clientId, count: rows.length });
  const pages = rows.map((p) => ({ id: p.id, name: p.name }));
  return NextResponse.json({ pages });
}
