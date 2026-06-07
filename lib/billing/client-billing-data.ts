import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentSettings } from "@/components/billing/HowToPay";
import type { ClientSubscription, ClientInvoice } from "@/components/billing/ClientBillingView";

export type ClientBillingData = {
  subscription: ClientSubscription;
  invoices: ClientInvoice[];
  outstanding: number;
  currency: string;
  settings: PaymentSettings;
  /** The oldest unpaid (sent/overdue) invoice — used by the blocked screen. */
  overdueInvoice: ClientInvoice | null;
};

const UNPAID = ["sent", "overdue"];

const EMPTY_SETTINGS: PaymentSettings = {
  bank_name: null,
  bank_account_name: null,
  bank_account_number: null,
  bank_branch: null,
  swift: null,
  mobile_money_number: null,
  mobile_money_name: null,
  payment_instructions: null,
};

export async function getClientBillingData(clientId: string): Promise<ClientBillingData> {
  const supabase = createAdminClient();

  const [{ data: sub }, { data: invoiceRows }, { data: pending }, { data: settingsRow }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan, billing_cycle, amount, currency, status, current_period_end")
        .eq("client_id", clientId)
        .eq("product", "crm")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("invoices")
        .select("id, invoice_number, amount, currency, status, issued_at, due_at, pdf_url")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("invoice_id")
        .eq("client_id", clientId)
        .eq("status", "pending"),
      supabase
        .from("billing_settings")
        .select(
          "bank_name, bank_account_name, bank_account_number, bank_branch, swift, mobile_money_number, mobile_money_name, payment_instructions"
        )
        .limit(1)
        .maybeSingle(),
    ]);

  const pendingInvoiceIds = new Set((pending ?? []).map((p) => p.invoice_id as string));

  const invoices: ClientInvoice[] = (invoiceRows ?? []).map((i) => ({
    id: i.id as string,
    invoiceNumber: i.invoice_number as string,
    amount: Number(i.amount),
    currency: i.currency as string,
    status: i.status as string,
    issuedAt: (i.issued_at as string | null) ?? null,
    dueAt: (i.due_at as string | null) ?? null,
    pdfUrl: (i.pdf_url as string | null) ?? null,
    hasPendingPayment: pendingInvoiceIds.has(i.id as string),
  }));

  const outstanding = invoices
    .filter((i) => UNPAID.includes(i.status))
    .reduce((sum, i) => sum + i.amount, 0);

  const subscription: ClientSubscription = sub
    ? {
        plan: sub.plan as string,
        billingCycle: sub.billing_cycle as string,
        amount: Number(sub.amount),
        currency: sub.currency as string,
        status: sub.status as string,
        currentPeriodEnd: (sub.current_period_end as string | null) ?? null,
      }
    : null;

  const currency = subscription?.currency ?? invoices[0]?.currency ?? "USD";

  const overdueInvoice =
    invoices.find((i) => i.status === "overdue") ??
    invoices.find((i) => UNPAID.includes(i.status)) ??
    null;

  return {
    subscription,
    invoices,
    outstanding,
    currency,
    settings: (settingsRow as PaymentSettings | null) ?? EMPTY_SETTINGS,
    overdueInvoice,
  };
}
