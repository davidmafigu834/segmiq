import { createAdminClient } from "@/lib/supabase/admin";
import { putObject, getPublicUrl } from "@/lib/storage/r2";
import { renderInvoicePdf } from "@/lib/billing/invoice-pdf";
import { notifyInvoiceIssued } from "@/lib/billing/notifications";
import { getClientNotificationEmails } from "@/lib/billing/recipients";
import { CRM_PLAN_LABELS, type CrmPlan } from "@/lib/billing/plans";

export type IssueInvoiceResult = {
  invoiceId: string;
  invoiceNumber: string;
  alreadyExisted: boolean;
  pdfUrl: string | null;
  emailed: boolean;
};

function planLabelFor(plan: string): string {
  return CRM_PLAN_LABELS[plan as CrmPlan] ?? plan;
}

/**
 * Issues an invoice for a subscription's current period.
 *
 * The number allocation + invoice insert happen atomically inside the
 * `create_crm_invoice` Postgres function (year-scoped counter locked with
 * SELECT ... FOR UPDATE), which is also idempotent per period: a second call for
 * a period that already has a non-void invoice returns the existing one and does
 * NOT generate a new PDF or send a second email.
 */
export async function issueInvoiceForSubscription(
  subscriptionId: string
): Promise<IssueInvoiceResult> {
  const supabase = createAdminClient();

  const { data: rows, error: rpcError } = await supabase.rpc("create_crm_invoice", {
    p_subscription_id: subscriptionId,
  });
  if (rpcError) {
    throw new Error(`Failed to allocate invoice: ${rpcError.message}`);
  }
  const allocation = Array.isArray(rows) ? rows[0] : rows;
  if (!allocation) {
    throw new Error("Invoice allocation returned no row");
  }

  const invoiceId = allocation.invoice_id as string;
  const invoiceNumber = allocation.invoice_number as string;
  const alreadyExisted = Boolean(allocation.already_existed);

  // Idempotent: an invoice already covers this period — do not re-issue.
  if (alreadyExisted) {
    const { data: existing } = await supabase
      .from("invoices")
      .select("pdf_url")
      .eq("id", invoiceId)
      .maybeSingle();
    return {
      invoiceId,
      invoiceNumber,
      alreadyExisted: true,
      pdfUrl: (existing?.pdf_url as string | null) ?? null,
      emailed: false,
    };
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, amount, currency, period_start, period_end, issued_at, due_at, client_id, subscription_id")
    .eq("id", invoiceId)
    .single();
  if (invoiceError || !invoice) {
    throw new Error(`Failed to load issued invoice: ${invoiceError?.message ?? "not found"}`);
  }

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("id", subscriptionId)
    .single();
  if (subError || !subscription) {
    throw new Error(`Failed to load subscription: ${subError?.message ?? "not found"}`);
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", invoice.client_id)
    .maybeSingle();

  const recipientEmails = await getClientNotificationEmails(invoice.client_id as string);

  const { data: settings } = await supabase
    .from("billing_settings")
    .select(
      "bank_name, bank_account_name, bank_account_number, bank_branch, swift, mobile_money_number, mobile_money_name, payment_instructions"
    )
    .limit(1)
    .maybeSingle();

  const planLabel = planLabelFor(subscription.plan as string);
  const amount = Number(invoice.amount);
  const currency = invoice.currency as string;

  const pdfBuffer = await renderInvoicePdf({
    invoiceNumber,
    issuedAt: new Date(invoice.issued_at as string),
    dueAt: new Date(invoice.due_at as string),
    clientName: (client?.name as string | null) ?? "Client",
    clientEmail: recipientEmails[0] ?? null,
    planLabel,
    periodStart: invoice.period_start ? new Date(invoice.period_start as string) : null,
    periodEnd: invoice.period_end ? new Date(invoice.period_end as string) : null,
    amount,
    currency,
    payment: {
      bankName: (settings?.bank_name as string | null) ?? null,
      bankAccountName: (settings?.bank_account_name as string | null) ?? null,
      bankAccountNumber: (settings?.bank_account_number as string | null) ?? null,
      bankBranch: (settings?.bank_branch as string | null) ?? null,
      swift: (settings?.swift as string | null) ?? null,
      mobileMoneyNumber: (settings?.mobile_money_number as string | null) ?? null,
      mobileMoneyName: (settings?.mobile_money_name as string | null) ?? null,
      instructions: (settings?.payment_instructions as string | null) ?? null,
    },
  });

  const pdfKey = `billing/invoices/${invoiceNumber}.pdf`;
  await putObject(pdfKey, pdfBuffer, "application/pdf");
  const pdfUrl = getPublicUrl(pdfKey);

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (updateError) {
    throw new Error(`Failed to save pdf_url: ${updateError.message}`);
  }

  const { emailed } = await notifyInvoiceIssued({
    clientId: invoice.client_id as string,
    clientName: (client?.name as string | null) ?? "Client",
    invoiceNumber,
    planLabel,
    amount,
    currency,
    dueAt: invoice.due_at as string | null,
    periodStart: invoice.period_start as string | null,
    periodEnd: invoice.period_end as string | null,
    invoiceUrl: pdfUrl,
    pdfBuffer,
  });
  if (!emailed && recipientEmails.length === 0) {
    console.warn(`Invoice ${invoiceNumber}: no billing recipients; email skipped.`);
  }

  return { invoiceId, invoiceNumber, alreadyExisted: false, pdfUrl, emailed };
}
