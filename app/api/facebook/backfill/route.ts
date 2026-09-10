import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { createLead } from "@/lib/leads/createLead";
import { graphCall } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { loadClientFbGraphTokens } from "@/lib/facebook/client-tokens";

const lastBackfillByClient = new Map<string, number>();
const COOLDOWN_MS = 60_000;

type LeadsPage = {
  data?: { id: string; created_time?: string; field_data?: { name: string; values: string[] }[] }[];
  paging?: { next?: string };
};

export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { clientId?: string; sinceIso?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientId = body.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const since = body.sinceIso ? new Date(body.sinceIso) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid sinceIso" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, fb_form_id")
    .eq("id", clientId)
    .maybeSingle();

  const { pageToken } = await loadClientFbGraphTokens(clientId, supabase);

  if (!pageToken || !client?.fb_form_id) {
    return NextResponse.json({ error: "Facebook not connected for this client" }, { status: 400 });
  }

  const now = Date.now();
  const last = lastBackfillByClient.get(clientId) ?? 0;
  if (now - last < COOLDOWN_MS) {
    return NextResponse.json({ error: "Rate limited: one backfill per client per minute" }, { status: 429 });
  }
  lastBackfillByClient.set(clientId, now);

  fbLog("fb.backfill.started", { clientId, since: since.toISOString() });

  const sinceEpoch = Math.floor(since.getTime() / 1000);
  const filter = encodeURIComponent(
    JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: sinceEpoch }])
  );
  const fields = encodeURIComponent("id,created_time,field_data");
  let pathOrUrl = `/${client.fb_form_id}/leads?fields=${fields}&filtering=${filter}&limit=100`;

  const stats = { fetched: 0, created: 0, duplicates: 0, failed: 0 };

  for (let page = 0; page < 10; page++) {
    const result = await graphCall<LeadsPage>(pathOrUrl, pageToken, { clientId });

    if (!result.ok) {
      fbLog("fb.backfill.completed", {
        clientId,
        ...stats,
        error: result.error.message,
        tokenExpired: result.tokenExpired,
      });
      return NextResponse.json(
        {
          error: result.error.message,
          tokenExpired: result.tokenExpired,
          ...stats,
          since: since.toISOString(),
        },
        { status: 502 }
      );
    }

    const batch = result.data.data ?? [];
    stats.fetched += batch.length;

    for (const fbLead of batch) {
      const formData: Record<string, string> = {};
      for (const field of fbLead.field_data || []) {
        if (field.name && field.values?.[0]) {
          formData[field.name] = field.values[0];
        }
      }

      const cr = await createLead({
        clientId,
        source: "FACEBOOK",
        formData,
        facebookLeadId: fbLead.id,
      });

      if (cr.ok) {
        if (cr.duplicate) stats.duplicates += 1;
        else stats.created += 1;
      } else {
        stats.failed += 1;
        fbLog("fb.lead.submit_failed", { clientId, leadgen_id: fbLead.id, error: cr.error });
      }
    }

    const next = result.data.paging?.next;
    if (!next) break;
    pathOrUrl = next;
  }

  fbLog("fb.backfill.completed", { clientId, ...stats });

  const session = await getServerSession(authOptions);
  const { data: cRow } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  const nm = (cRow as { name?: string } | null)?.name ?? "Client";
  if (session?.userId) {
    await supabase.from("notifications").insert({
      user_id: session.userId,
      type: "BACKFILL_COMPLETE",
      message: `Backfilled ${stats.created} leads for ${nm} (${stats.duplicates} duplicates, ${stats.failed} failed)`,
      lead_id: null,
      client_id: clientId,
      read: false,
    });
  }

  return NextResponse.json({ ok: true, ...stats, since: since.toISOString() });
}
