import { createAdminClient } from "@/lib/supabase/admin";
import { notifyViewingReminder } from "@/lib/real-estate/notifications";
import { listingLabel } from "@/lib/real-estate/helpers";

/** Catch the T-30 mark once with the every-minute cron (28–32 minutes before). */
const T30_WINDOW_MS = {
  minUntil: 28 * 60 * 1000,
  maxUntil: 32 * 60 * 1000,
};

export type ViewingReminderResult = {
  ok: boolean;
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun?: boolean;
};

async function claimOnce(claimKey: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("reminder_send_claims").insert({ claim_key: claimKey });
  if (!error) return true;
  if (error.code === "23505") return false;
  if (error.message?.includes("reminder_send_claims") || error.message?.includes("does not exist")) {
    console.warn("[viewing-reminders] reminder_send_claims missing; apply migration 085");
    return true;
  }
  console.error("[viewing-reminders] claim failed", error);
  return false;
}

export async function executeViewingReminders(opts?: {
  dryRun?: boolean;
  force?: boolean;
}): Promise<ViewingReminderResult> {
  const supabase = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now + T30_WINDOW_MS.minUntil).toISOString();
  const windowEnd = new Date(now + T30_WINDOW_MS.maxUntil).toISOString();

  const { data: viewings, error } = await supabase
    .from("viewings")
    .select(
      `
      id, scheduled_at, status, reminder_sent_at, contact_id, listing_id, agent_id,
      contacts(name, phone),
      listings!inner(id, client_id, address, suburb, external_reference),
      users:agent_id(name)
    `
    )
    .eq("status", "scheduled")
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", windowEnd)
    .limit(200);

  if (error) {
    console.error("[viewing-reminders] query failed", error);
    return { ok: false, scanned: 0, sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const v of viewings ?? []) {
    if (v.reminder_sent_at && !opts?.force) {
      skipped += 1;
      continue;
    }

    const listing = v.listings as {
      id: string;
      client_id: string;
      address?: string | null;
      suburb?: string | null;
      external_reference?: string | null;
    };
    const contact = v.contacts as { name?: string | null; phone?: string | null } | null;
    const agent = v.users as { name?: string | null } | null;
    const phone = contact?.phone?.trim();
    if (!phone) {
      skipped += 1;
      continue;
    }

    const claimKey = `viewing_t30:${v.id}:${v.scheduled_at}`;
    if (!opts?.dryRun) {
      const claimed = await claimOnce(claimKey);
      if (!claimed && !opts?.force) {
        skipped += 1;
        continue;
      }
    }

    if (opts?.dryRun) {
      sent += 1;
      continue;
    }

    try {
      await notifyViewingReminder({
        clientId: listing.client_id,
        to: phone,
        contactName: contact?.name ?? null,
        listing: listing,
        scheduledAt: v.scheduled_at as string,
        agentName: agent?.name ?? null,
      });
      await supabase
        .from("viewings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", v.id as string);
      sent += 1;
    } catch (err) {
      console.error("[viewing-reminders] send failed", v.id, err);
      failed += 1;
    }
  }

  void listingLabel;
  return {
    ok: true,
    scanned: (viewings ?? []).length,
    sent,
    failed,
    skipped,
    dryRun: opts?.dryRun,
  };
}
