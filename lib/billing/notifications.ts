import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { invoiceIssuedEmail } from "@/lib/email/templates/invoice-issued";
import { paymentOverdueEmail } from "@/lib/email/templates/payment-overdue";
import { paymentConfirmedEmail } from "@/lib/email/templates/payment-confirmed";
import { getClientNotificationEmails, getClientBillingContacts } from "@/lib/billing/recipients";
import { clientBillingPath } from "@/lib/billing/client-access";
import { normalizeBillingPhone } from "@/lib/billing/phone";
import { formatDate, formatMoney } from "@/lib/billing/format";
import { getPublicBaseUrl } from "@/lib/constants";
import { sendWhatsApp, isWhatsAppDeliveryConfigured } from "@/lib/messaging/provider";

async function billingPageUrl(clientId: string): Promise<string> {
  const path = await clientBillingPath(clientId);
  return `${getPublicBaseUrl()}${path}`;
}

async function billingUrlSuffix(clientId: string): Promise<string> {
  const path = await clientBillingPath(clientId);
  return path.replace(/^\//, "");
}

function waBillingWhatsAppEnabled(): boolean {
  return isWhatsAppDeliveryConfigured();
}

type BillingContact = {
  id: string;
  email: string | null;
  phone: string | null;
};

async function loadBillingContacts(clientId: string): Promise<BillingContact[]> {
  return getClientBillingContacts(clientId);
}

async function loadClientDialCode(clientId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("clients").select("dial_code").eq("id", clientId).maybeSingle();
  return (data?.dial_code as string | null) ?? null;
}

async function sendBillingWhatsApp(params: {
  clientId: string;
  contacts: BillingContact[];
  dialCode: string | null;
  template: "INVOICE_ISSUED" | "PAYMENT_OVERDUE" | "PAYMENT_CONFIRMED";
  variables: Record<string, string>;
  fallbackBody: string;
  notificationType: string;
}): Promise<void> {
  const urlSuffix = await billingUrlSuffix(params.clientId);
  for (const contact of params.contacts) {
    const phone = normalizeBillingPhone(contact.phone, params.dialCode);
    if (!phone) continue;
    await sendWhatsApp({
      to: phone,
      template: params.template,
      variables: params.variables,
      fallbackBody: params.fallbackBody,
      urlButtonParam: urlSuffix,
      context: {
        userId: contact.id,
        clientId: params.clientId,
        notificationType: params.notificationType,
        rawRecipientForLog: contact.phone ?? undefined,
      },
    });
  }
}

/** Invoice issued — email always; WhatsApp when Meta Cloud API is configured. */
export async function notifyInvoiceIssued(params: {
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  planLabel: string;
  amount: number;
  currency: string;
  dueAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  invoiceUrl: string | null;
  pdfBuffer?: Buffer;
}): Promise<{ emailed: boolean }> {
  const emails = await getClientNotificationEmails(params.clientId);
  const period =
    params.periodStart && params.periodEnd
      ? `${formatDate(params.periodStart)} – ${formatDate(params.periodEnd)}`
      : "Current period";
  const amountFormatted = formatMoney(params.amount, params.currency);

  let emailed = false;
  if (emails.length > 0) {
    const { subject, html } = invoiceIssuedEmail({
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber,
      planLabel: params.planLabel,
      amountFormatted,
      dueDate: formatDate(params.dueAt),
      period,
      invoiceUrl: params.invoiceUrl,
    });
    const result = await sendEmail({
      to: emails,
      subject,
      html,
      ...(params.pdfBuffer
        ? { attachments: [{ filename: `${params.invoiceNumber}.pdf`, content: params.pdfBuffer }] }
        : {}),
    });
    emailed = result.success;
  }

  if (waBillingWhatsAppEnabled()) {
    const [contacts, dialCode] = await Promise.all([
      loadBillingContacts(params.clientId),
      loadClientDialCode(params.clientId),
    ]);
    await sendBillingWhatsApp({
      clientId: params.clientId,
      contacts,
      dialCode,
      template: "INVOICE_ISSUED",
      variables: {
        "1": params.invoiceNumber,
        "2": amountFormatted,
        "3": formatDate(params.dueAt),
      },
      fallbackBody: `Invoice ${params.invoiceNumber} for ${amountFormatted} is ready. Due ${formatDate(params.dueAt)}.`,
      notificationType: "INVOICE_ISSUED",
    });
  }

  return { emailed };
}

/** Overdue or final-warning reminder — email always; WhatsApp when approved. */
export async function notifyPaymentOverdue(params: {
  clientId: string;
  clientName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  daysUntilSuspension: number;
  isFinalWarning?: boolean;
}): Promise<void> {
  const emails = await getClientNotificationEmails(params.clientId);
  const amountFormatted = formatMoney(params.amount, params.currency);
  const billingUrl = await billingPageUrl(params.clientId);

  if (emails.length > 0) {
    const { subject, html } = paymentOverdueEmail({
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber,
      amountFormatted,
      daysUntilSuspension: params.daysUntilSuspension,
      billingUrl,
      isFinalWarning: params.isFinalWarning,
    });
    await sendEmail({ to: emails, subject, html });
  }

  if (waBillingWhatsAppEnabled()) {
    const [contacts, dialCode] = await Promise.all([
      loadBillingContacts(params.clientId),
      loadClientDialCode(params.clientId),
    ]);
    await sendBillingWhatsApp({
      clientId: params.clientId,
      contacts,
      dialCode,
      template: "PAYMENT_OVERDUE",
      variables: {
        "1": params.invoiceNumber,
        "2": amountFormatted,
        "3": String(params.daysUntilSuspension),
      },
      fallbackBody: `Invoice ${params.invoiceNumber} (${amountFormatted}) is overdue. ${params.daysUntilSuspension} day(s) until suspension.`,
      notificationType: params.isFinalWarning ? "PAYMENT_OVERDUE_FINAL" : "PAYMENT_OVERDUE",
    });
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const col = params.isFinalWarning ? "suspension_warning_notified_at" : "overdue_notified_at";
  await supabase.from("invoices").update({ [col]: now, updated_at: now }).eq("id", params.invoiceId);
}

/** Payment confirmed — email always; WhatsApp when approved. */
export async function notifyPaymentConfirmed(params: {
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  nextRenewalDate: string | null;
}): Promise<void> {
  const emails = await getClientNotificationEmails(params.clientId);
  const amountFormatted = formatMoney(params.amount, params.currency);
  const billingUrl = await billingPageUrl(params.clientId);

  if (emails.length > 0) {
    const { subject, html } = paymentConfirmedEmail({
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber,
      amountFormatted,
      nextRenewalDate: formatDate(params.nextRenewalDate),
      billingUrl,
    });
    await sendEmail({ to: emails, subject, html });
  }

  if (waBillingWhatsAppEnabled()) {
    const [contacts, dialCode] = await Promise.all([
      loadBillingContacts(params.clientId),
      loadClientDialCode(params.clientId),
    ]);
    await sendBillingWhatsApp({
      clientId: params.clientId,
      contacts,
      dialCode,
      template: "PAYMENT_CONFIRMED",
      variables: {
        "1": params.invoiceNumber,
        "2": amountFormatted,
        "3": formatDate(params.nextRenewalDate),
      },
      fallbackBody: `Payment confirmed for ${params.invoiceNumber} (${amountFormatted}). Next renewal ${formatDate(params.nextRenewalDate)}.`,
      notificationType: "PAYMENT_CONFIRMED",
    });
  }
}
