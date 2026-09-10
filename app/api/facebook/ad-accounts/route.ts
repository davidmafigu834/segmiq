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
  const token = userToken || pageToken;
  if (!token) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const fields = encodeURIComponent("id,name,account_id,account_status");
  const result = await graphCall<{ data?: { id: string; name: string; account_id?: string; account_status?: number }[] }>(
    `/me/adaccounts?fields=${fields}`,
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
  fbLog("fb.ad_account.listed", { clientId, count: rows.length });
  const accounts = rows.map((a) => ({
    id: a.id,
    name: a.name ?? a.id,
    accountId: a.account_id ?? a.id.replace(/^act_/, ""),
  }));

  return NextResponse.json({ accounts });
}
