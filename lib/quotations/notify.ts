import { createAdminClient } from "@/lib/supabase/admin";
import type { ApproverTarget } from "@/lib/quotations/approver-authority";

type QuotationAlert = {
  userId: string;
  leadId?: string | null;
  quotationId?: string | null;
  message: string;
};

async function insertAlert(opts: QuotationAlert): Promise<void> {
  if (!opts.userId) return;
  const supabase = createAdminClient();
  const row: Record<string, unknown> = {
    user_id: opts.userId,
    type: "QUOTATION_ALERT",
    message: opts.message,
    read: false,
    lead_id: opts.leadId || null,
  };
  if (opts.quotationId) row.quotation_id = opts.quotationId;
  const { error } = await supabase.from("notifications").insert(row);
  if (error && opts.quotationId) {
    delete row.quotation_id;
    const retry = await supabase.from("notifications").insert(row);
    if (retry.error) console.error("[quotation notify]", retry.error);
    return;
  }
  if (error) console.error("[quotation notify]", error);
}

export async function notifyQuotationAlert(opts: QuotationAlert): Promise<void> {
  try {
    await insertAlert(opts);
  } catch (err) {
    console.error("[quotation notify]", err);
  }
}

export async function notifyClientManagers(opts: {
  clientId: string;
  leadId?: string | null;
  quotationId?: string | null;
  message: string;
  excludeUserId?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("client_id", opts.clientId)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true);
    for (const u of data ?? []) {
      if (opts.excludeUserId && u.id === opts.excludeUserId) continue;
      await notifyQuotationAlert({
        userId: u.id as string,
        leadId: opts.leadId,
        quotationId: opts.quotationId,
        message: opts.message,
      });
    }
  } catch (err) {
    console.error("[quotation notify managers]", err);
  }
}

/** Notify the people named by the triggered approval rules, not every manager. */
export async function notifyApprovers(opts: {
  clientId: string;
  leadId?: string | null;
  quotationId?: string | null;
  message: string;
  excludeUserId?: string | null;
  targets: ApproverTarget[];
}): Promise<void> {
  const named = Array.from(
    new Set(opts.targets.map((t) => t.approverUserId).filter((id): id is string => Boolean(id)))
  ).filter((id) => id !== opts.excludeUserId);

  if (named.length > 0) {
    for (const userId of named) {
      await notifyQuotationAlert({
        userId,
        leadId: opts.leadId,
        quotationId: opts.quotationId,
        message: opts.message,
      });
    }
    return;
  }

  await notifyClientManagers({
    clientId: opts.clientId,
    leadId: opts.leadId,
    quotationId: opts.quotationId,
    message: opts.message,
    excludeUserId: opts.excludeUserId,
  });
}
