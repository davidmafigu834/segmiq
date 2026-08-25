import type { SupabaseClient } from "@supabase/supabase-js";
import { logQuotationEvent } from "@/lib/quotations/events";

const VIEW_AGGREGATE_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Record a real customer secure-page view.
 * First view: status → viewed, VIEWED event, notification.
 * Repeat views: increment count; do not spam the activity timeline.
 */
export async function recordCustomerView(
  supabase: SupabaseClient,
  opts: {
    quotationId: string;
    clientId: string;
    leadId: string | null;
    dealId: string | null;
    publicToken: string;
    userAgent?: string | null;
    currentStatus: string;
    viewedAt: string | null;
    lastViewedAt: string | null;
    viewCount: number;
    ownerId?: string | null;
  }
): Promise<{ firstView: boolean; viewCount: number }> {
  const now = new Date();
  const nowIso = now.toISOString();
  await supabase.from("quotation_views").insert({
    quotation_id: opts.quotationId,
    client_id: opts.clientId,
    public_token: opts.publicToken,
    viewed_at: nowIso,
    user_agent: opts.userAgent ? String(opts.userAgent).slice(0, 180) : null,
  });

  const firstView = !opts.viewedAt && (opts.currentStatus === "sent" || opts.currentStatus === "viewed");
  const last = opts.lastViewedAt ? new Date(opts.lastViewedAt).getTime() : 0;
  const recentRepeat = last > 0 && now.getTime() - last < VIEW_AGGREGATE_WINDOW_MS;
  const nextCount = (Number(opts.viewCount) || 0) + 1;

  const updates: Record<string, unknown> = {
    view_count: nextCount,
    last_viewed_at: nowIso,
    updated_at: nowIso,
  };
  if (opts.currentStatus === "sent") {
    updates.status = "viewed";
    updates.viewed_at = opts.viewedAt ?? nowIso;
  } else if (!opts.viewedAt) {
    updates.viewed_at = nowIso;
  }

  await supabase.from("quotations").update(updates).eq("id", opts.quotationId);

  if (firstView || (!opts.viewedAt && opts.currentStatus === "sent")) {
    await logQuotationEvent(supabase, {
      quotationId: opts.quotationId,
      clientId: opts.clientId,
      leadId: opts.leadId,
      dealId: opts.dealId,
      actor: { id: null, name: "Customer" },
      eventType: "VIEWED",
      eventData: { first: true },
    });
  } else if (!recentRepeat && nextCount > 1) {
    await logQuotationEvent(supabase, {
      quotationId: opts.quotationId,
      clientId: opts.clientId,
      leadId: opts.leadId,
      dealId: opts.dealId,
      actor: { id: null, name: "Customer" },
      eventType: "VIEWED",
      eventData: { count: nextCount, aggregate: true },
    });
  }

  const viewed = { firstView: Boolean(firstView || !opts.viewedAt), viewCount: nextCount };
  const { hookQuotationViewed } = await import("@/lib/agent/proactive");
  void hookQuotationViewed({
    clientId: opts.clientId,
    quotationId: opts.quotationId,
    firstView: viewed.firstView,
  });
  return viewed;
}
