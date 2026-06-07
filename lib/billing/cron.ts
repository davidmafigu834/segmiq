import { createAdminClient } from "@/lib/supabase/admin";
import { issueInvoiceForSubscription } from "@/lib/billing/invoicing";
import { notifyPaymentOverdue } from "@/lib/billing/notifications";
import { BILLING_REMINDER_CONFIG } from "@/lib/billing/reminder-config";

export type BillingCronResult = {
  renewalInvoicesIssued: number;
  renewalInvoicesSkipped: number;
  invoicesMarkedOverdue: number;
  overdueRemindersSent: number;
  finalWarningsSent: number;
  subscriptionsSuspended: number;
  errors: string[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Daily billing transitions — idempotent (safe to run twice per day).
 *
 * 1. Issue renewal invoices when current_period_end is reached (engine idempotency).
 * 2. Mark unpaid past-due invoices overdue + subscription past_due; send overdue reminder.
 * 3. Send final warning BILLING_REMINDER_CONFIG.finalWarningDaysBeforeSuspension day(s) before suspension.
 * 4. Suspend subscriptions still unpaid at due_at + grace_days (read per subscription).
 */
export async function runBillingDailyCron(): Promise<BillingCronResult> {
  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const result: BillingCronResult = {
    renewalInvoicesIssued: 0,
    renewalInvoicesSkipped: 0,
    invoicesMarkedOverdue: 0,
    overdueRemindersSent: 0,
    finalWarningsSent: 0,
    subscriptionsSuspended: 0,
    errors: [],
  };

  // ── 1. Renewal invoices at period boundary ────────────────────────────────
  const { data: renewals } = await supabase
    .from("subscriptions")
    .select("id, client_id, status, current_period_end")
    .eq("product", "crm")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", nowIso);

  for (const sub of renewals ?? []) {
    try {
      const r = await issueInvoiceForSubscription(sub.id as string);
      if (r.alreadyExisted) result.renewalInvoicesSkipped++;
      else result.renewalInvoicesIssued++;
    } catch (e) {
      result.errors.push(`renewal ${sub.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 2. Overdue transitions + day-of overdue reminder ──────────────────────
  const { data: overdueCandidates } = await supabase
    .from("invoices")
    .select("id, subscription_id, client_id, invoice_number, amount, currency, due_at, overdue_notified_at")
    .in("status", ["sent"])
    .lt("due_at", nowIso);

  for (const inv of overdueCandidates ?? []) {
    const { data: updated } = await supabase
      .from("invoices")
      .update({ status: "overdue", updated_at: nowIso })
      .eq("id", inv.id)
      .eq("status", "sent")
      .select("id");
    if ((updated?.length ?? 0) === 0) continue;
    result.invoicesMarkedOverdue++;

    await supabase
      .from("subscriptions")
      .update({ status: "past_due", updated_at: nowIso })
      .eq("id", inv.subscription_id)
      .in("status", ["active", "past_due"]);

    if (!inv.overdue_notified_at) {
      try {
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", inv.client_id)
          .maybeSingle();
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("grace_days")
          .eq("id", inv.subscription_id)
          .maybeSingle();
        const graceDays = Number((sub as { grace_days?: number } | null)?.grace_days ?? 7);
        const dueAt = new Date(inv.due_at as string);
        const suspendAt = dueAt.getTime() + graceDays * MS_PER_DAY;
        const daysUntil = Math.max(0, Math.ceil((suspendAt - now.getTime()) / MS_PER_DAY));

        await notifyPaymentOverdue({
          clientId: inv.client_id as string,
          clientName: (client?.name as string | null) ?? "there",
          invoiceId: inv.id as string,
          invoiceNumber: inv.invoice_number as string,
          amount: Number(inv.amount),
          currency: inv.currency as string,
          daysUntilSuspension: daysUntil,
        });
        result.overdueRemindersSent++;
      } catch (e) {
        result.errors.push(`overdue notify ${inv.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // ── 3. Final warning before suspension ────────────────────────────────────
  const { data: warningCandidates } = await supabase
    .from("invoices")
    .select(
      "id, subscription_id, client_id, invoice_number, amount, currency, due_at, suspension_warning_notified_at"
    )
    .in("status", ["overdue"])
    .is("suspension_warning_notified_at", null);

  for (const inv of warningCandidates ?? []) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("grace_days, status")
      .eq("id", inv.subscription_id)
      .maybeSingle();
    if (!sub || (sub.status as string) === "suspended") continue;

    const graceDays = Number(sub.grace_days ?? 7);
    const dueAt = new Date(inv.due_at as string);
    const suspendAt = dueAt.getTime() + graceDays * MS_PER_DAY;
    const warningLeadMs = BILLING_REMINDER_CONFIG.finalWarningDaysBeforeSuspension * MS_PER_DAY;
    const warningAt = suspendAt - warningLeadMs;

    if (now.getTime() < warningAt) continue;

    const daysUntil = Math.max(0, Math.ceil((suspendAt - now.getTime()) / MS_PER_DAY));
    try {
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", inv.client_id)
        .maybeSingle();
      await notifyPaymentOverdue({
        clientId: inv.client_id as string,
        clientName: (client?.name as string | null) ?? "there",
        invoiceId: inv.id as string,
        invoiceNumber: inv.invoice_number as string,
        amount: Number(inv.amount),
        currency: inv.currency as string,
        daysUntilSuspension: daysUntil,
        isFinalWarning: true,
      });
      result.finalWarningsSent++;
    } catch (e) {
      result.errors.push(`final warning ${inv.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 4. Suspend at due_at + grace_days ─────────────────────────────────────
  const { data: suspendCandidates } = await supabase
    .from("invoices")
    .select("id, subscription_id, client_id, due_at")
    .in("status", ["overdue"]);

  const subIdsToCheck = Array.from(new Set((suspendCandidates ?? []).map((i) => i.subscription_id as string)));
  if (subIdsToCheck.length) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, grace_days, status")
      .in("id", subIdsToCheck)
      .neq("status", "suspended");

    const subById = new Map((subs ?? []).map((s) => [s.id as string, s]));

    for (const inv of suspendCandidates ?? []) {
      const sub = subById.get(inv.subscription_id as string);
      if (!sub) continue;
      const graceDays = Number(sub.grace_days ?? 7);
      const suspendAt = new Date(inv.due_at as string).getTime() + graceDays * MS_PER_DAY;
      if (now.getTime() < suspendAt) continue;

      const { data: suspended } = await supabase
        .from("subscriptions")
        .update({ status: "suspended", updated_at: nowIso })
        .eq("id", sub.id)
        .neq("status", "suspended")
        .select("id");
      if ((suspended?.length ?? 0) > 0) result.subscriptionsSuspended++;
    }
  }

  return result;
}
