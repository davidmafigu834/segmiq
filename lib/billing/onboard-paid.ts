import { createAdminClient } from "@/lib/supabase/admin";
import { issueInvoiceForSubscription } from "@/lib/billing/invoicing";
import { applyPayment } from "@/lib/billing/payments";
import { periodEndFromStart, type BillingCycle, type CrmPlan } from "@/lib/billing/plans";
import { sendEmail } from "@/lib/email/resend";
import { getClientNotificationEmails } from "@/lib/billing/recipients";
import { getObject } from "@/lib/storage/r2";
import { invoiceIssuedEmail } from "@/lib/email/templates/invoice-issued";
import { CRM_PLAN_LABELS } from "@/lib/billing/plans";
import { formatDate } from "@/lib/billing/format";

const PLANS: CrmPlan[] = ["starter", "growth", "scale"];
const CYCLES: BillingCycle[] = ["monthly", "annual"];
const METHODS = ["bank_transfer", "mobile_money", "cash", "other"];

export type OnboardPaidClientInput = {
  clientId: string;
  plan: string;
  billingCycle: string;
  amount: number;
  periodStart: string;
  paymentAmount: number;
  method: string;
  methodDetail?: string | null;
  reference?: string | null;
  paidAt: string;
  notifyClient?: boolean;
};

export type OnboardPaidClientResult = {
  subscriptionId: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentId: string;
  receiptId?: string;
  receiptNumber?: string;
  invoicePdfUrl: string | null;
  receiptPdfUrl: string | null;
  emailed: boolean;
  subscriptionUpdated: boolean;
};

export async function onboardPaidClient(
  input: OnboardPaidClientInput,
  recordedBy: string
): Promise<OnboardPaidClientResult> {
  if (!PLANS.includes(input.plan as CrmPlan)) {
    throw new Error("Invalid plan");
  }
  if (!CYCLES.includes(input.billingCycle as BillingCycle)) {
    throw new Error("Invalid billing cycle");
  }
  if (!METHODS.includes(input.method)) {
    throw new Error("Invalid payment method");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Invalid subscription amount");
  }
  if (!Number.isFinite(input.paymentAmount) || input.paymentAmount <= 0) {
    throw new Error("Invalid payment amount");
  }

  const plan = input.plan as CrmPlan;
  const cycle = input.billingCycle as BillingCycle;
  const periodStart = new Date(input.periodStart);
  const periodEnd = periodEndFromStart(periodStart, cycle);
  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(paidAt.getTime())) {
    throw new Error("Invalid date");
  }

  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", input.clientId)
    .maybeSingle();
  if (!client) {
    throw new Error("Client not found");
  }

  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("product", "crm")
    .maybeSingle();

  const subPayload = {
    plan,
    billing_cycle: cycle,
    amount: input.amount,
    currency: "USD",
    status: "active",
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    started_at: paidAt.toISOString(),
    cancelled_at: null,
    updated_at: new Date().toISOString(),
  };

  let subscriptionId: string;
  let subscriptionUpdated = false;

  if (existingSub?.id) {
    subscriptionId = existingSub.id as string;
    subscriptionUpdated = true;
    const { error } = await supabase
      .from("subscriptions")
      .update(subPayload)
      .eq("id", subscriptionId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabase
      .from("subscriptions")
      .insert({
        client_id: input.clientId,
        product: "crm",
        grace_days: 7,
        ...subPayload,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Failed to create subscription");
    subscriptionId = created.id as string;
  }

  const issued = await issueInvoiceForSubscription(subscriptionId);
  const invoiceId = issued.invoiceId;

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, amount, currency, invoice_number, period_start, period_end")
    .eq("id", invoiceId)
    .single();
  if (!invoice) throw new Error("Invoice not found after issue");

  const now = new Date().toISOString();
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      client_id: input.clientId,
      amount: input.paymentAmount,
      currency: invoice.currency,
      method: input.method,
      method_detail: input.methodDetail?.trim() || null,
      reference: input.reference?.trim() || null,
      status: "confirmed",
      recorded_via: "agency_manual",
      recorded_by: recordedBy,
      confirmed_by: recordedBy,
      confirmed_at: now,
      paid_at: paidAt.toISOString(),
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    throw new Error(payErr?.message ?? "Failed to record payment");
  }

  const applied = await applyPayment(payment.id as string, {
    skipPeriodAdvance: true,
    paidAt: paidAt.toISOString(),
  });

  const { data: invFinal } = await supabase
    .from("invoices")
    .select("pdf_url")
    .eq("id", invoiceId)
    .maybeSingle();
  const { data: receiptFinal } = applied.receiptId
    ? await supabase.from("receipts").select("pdf_url").eq("id", applied.receiptId).maybeSingle()
    : { data: null };

  let emailed = false;
  if (input.notifyClient !== false) {
    emailed = await sendOnboardDocumentsEmail({
      clientId: input.clientId,
      clientName: client.name as string,
      invoiceNumber: invoice.invoice_number as string,
      plan,
      amount: Number(invoice.amount),
      currency: invoice.currency as string,
      periodStart: invoice.period_start as string | null,
      periodEnd: invoice.period_end as string | null,
      paidAt: paidAt.toISOString(),
      invoicePdfUrl: (invFinal?.pdf_url as string | null) ?? issued.pdfUrl,
      receiptPdfUrl: (receiptFinal?.pdf_url as string | null) ?? null,
      receiptNumber: applied.receiptNumber ?? null,
    });
  }

  return {
    subscriptionId,
    invoiceId,
    invoiceNumber: issued.invoiceNumber,
    paymentId: payment.id as string,
    receiptId: applied.receiptId,
    receiptNumber: applied.receiptNumber,
    invoicePdfUrl: (invFinal?.pdf_url as string | null) ?? issued.pdfUrl,
    receiptPdfUrl: (receiptFinal?.pdf_url as string | null) ?? null,
    emailed,
    subscriptionUpdated,
  };
}

async function pdfBufferFromUrl(url: string | null, fallbackKey: string): Promise<Buffer | null> {
  if (url) {
    try {
      const base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";
      const key = url.startsWith(base) ? url.slice(base.length + 1) : fallbackKey;
      return await getObject(key);
    } catch {
      /* fall through */
    }
  }
  try {
    return await getObject(fallbackKey);
  } catch {
    return null;
  }
}

async function sendOnboardDocumentsEmail(params: {
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  plan: CrmPlan;
  amount: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string;
  invoicePdfUrl: string | null;
  receiptPdfUrl: string | null;
  receiptNumber: string | null;
}): Promise<boolean> {
  const emails = await getClientNotificationEmails(params.clientId);
  if (emails.length === 0) return false;

  const period =
    params.periodStart && params.periodEnd
      ? `${formatDate(params.periodStart)} – ${formatDate(params.periodEnd)}`
      : "Current period";
  const amountFormatted = `${params.currency} ${params.amount.toFixed(2)}`;
  const { subject, html } = invoiceIssuedEmail({
    clientName: params.clientName,
    invoiceNumber: params.invoiceNumber,
    planLabel: CRM_PLAN_LABELS[params.plan],
    amountFormatted,
    dueDate: formatDate(params.paidAt),
    period,
    invoiceUrl: params.invoicePdfUrl,
  });

  const attachments: { filename: string; content: Buffer }[] = [];
  const invBuf = await pdfBufferFromUrl(
    params.invoicePdfUrl,
    `billing/invoices/${params.invoiceNumber}.pdf`
  );
  if (invBuf) attachments.push({ filename: `${params.invoiceNumber}.pdf`, content: invBuf });
  if (params.receiptNumber) {
    const recBuf = await pdfBufferFromUrl(
      params.receiptPdfUrl,
      `billing/receipts/${params.receiptNumber}.pdf`
    );
    if (recBuf) attachments.push({ filename: `${params.receiptNumber}.pdf`, content: recBuf });
  }

  const result = await sendEmail({
    to: emails,
    subject: subject.replace("New invoice", "Your Segmiq subscription is active"),
    html: html.replace(
      "The PDF is attached to this email.",
      "Your invoice and receipt are attached to this email."
    ),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
  return result.success;
}
