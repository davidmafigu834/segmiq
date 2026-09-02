/**
 * Morning "Your focus today" digest — one useful summary, not spam.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodaysFocus } from "./service";
import { emitAttentionEvent } from "./observability";

async function alreadySentToday(userId: string, planDate: string): Promise<boolean> {
  const supabase = createAdminClient();
  const start = `${planDate}T00:00:00.000Z`;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "SALES_FOCUS_DIGEST")
    .gte("created_at", start);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function sendSalesFocusDigests(opts?: {
  clientId?: string;
}): Promise<{ sent: number; skipped: number; errors: number }> {
  const supabase = createAdminClient();
  let q = supabase
    .from("users")
    .select("id, client_id, name, role, notification_prefs")
    .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
    .eq("is_active", true);
  if (opts?.clientId) q = q.eq("client_id", opts.clientId);

  const { data: users, error } = await q.limit(2000);
  if (error) {
    console.error("[sales-focus-digest] load users failed", error.message);
    return { sent: 0, skipped: 0, errors: 1 };
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users ?? []) {
    try {
      const clientId = user.client_id ? String(user.client_id) : null;
      if (!clientId) {
        skipped += 1;
        continue;
      }

      const prefs = (user.notification_prefs ?? {}) as Record<string, unknown>;
      // Respect follow-up reminder preference as closest existing toggle;
      // allow explicit salesFocusDigest: false to opt out.
      if (prefs.salesFocusDigest === false) {
        skipped += 1;
        continue;
      }
      if (prefs.followUpReminders === false && prefs.salesFocusDigest !== true) {
        skipped += 1;
        continue;
      }

      const focus = await getTodaysFocus({
        userId: String(user.id),
        clientId,
      });

      if (focus.planError || focus.empty || focus.summary.total === 0) {
        skipped += 1;
        continue;
      }

      if (await alreadySentToday(String(user.id), focus.planDate)) {
        skipped += 1;
        continue;
      }

      const { summary } = focus;
      const parts = [
        summary.immediate > 0 ? `${summary.immediate} immediate` : null,
        summary.today > 0 ? `${summary.today} today` : null,
        summary.needsProgress > 0 ? `${summary.needsProgress} need progress` : null,
      ].filter(Boolean);

      const message = `Your focus today: ${summary.total} item${summary.total === 1 ? "" : "s"} need attention${
        parts.length ? ` (${parts.join(", ")})` : ""
      }. Open Today's Focus to start.`;

      const { error: insertErr } = await supabase.from("notifications").insert({
        user_id: user.id,
        type: "SALES_FOCUS_DIGEST",
        message,
        read: false,
        lead_id: focus.nextBest?.leadId ?? null,
      });

      if (insertErr) {
        // Type may not be migrated yet — soft-fail
        if (/SALES_FOCUS_DIGEST|notifications_type_check/i.test(insertErr.message)) {
          skipped += 1;
          continue;
        }
        errors += 1;
        continue;
      }

      await emitAttentionEvent({
        clientId,
        salespersonId: String(user.id),
        eventType: "sales_attention.digest_sent",
        payload: { total: summary.total, planDate: focus.planDate },
      });
      sent += 1;
    } catch (e) {
      console.error("[sales-focus-digest] user failed", user.id, e);
      errors += 1;
    }
  }

  return { sent, skipped, errors };
}
