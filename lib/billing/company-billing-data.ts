import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentSettings } from "@/components/billing/HowToPay";
import { methodLabel, maskSecretTail } from "./format";
import {
  CRM_PLAN_DESCRIPTIONS,
  CRM_PLAN_FEATURES,
  CRM_PLAN_SEATS,
  isCrmPlan,
  planLabel,
  type CrmPlan,
} from "./plans";
import { usagePercent } from "./status";
import type {
  CompanyBillingInvoice,
  CompanyBillingPageData,
  CompanyBillingSubscription,
  CompanyBillingUsageMetric,
  CompanyPaymentMethodDisplay,
} from "./company-billing-types";

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

export function emptyCompanyBillingPageData(clientId: string): CompanyBillingPageData {
  return {
    clientId,
    companyName: "Company",
    billingEmail: null,
    currency: "USD",
    subscription: null,
    invoices: [],
    outstanding: 0,
    usage: [],
    paymentSettings: EMPTY_SETTINGS,
    paymentMethod: { kind: "none", brandLabel: "No payment method added", masked: null, detail: null },
    capabilities: {
      canViewBilling: true,
      canManageSubscription: false,
      canManagePaymentMethods: true,
      canDownloadInvoices: true,
      canEditBillingInfo: true,
    },
    errors: {
      subscription: true,
      usage: true,
      invoices: true,
      paymentMethod: true,
    },
    generatedAt: new Date().toISOString(),
  };
}

function paymentMethodDisplay(settings: PaymentSettings): CompanyPaymentMethodDisplay {
  if (settings.bank_account_number || settings.bank_name) {
    return {
      kind: "bank_transfer",
      brandLabel: "Bank transfer",
      masked: maskSecretTail(settings.bank_account_number),
      detail: settings.bank_name,
    };
  }
  if (settings.mobile_money_number || settings.mobile_money_name) {
    return {
      kind: "mobile_money",
      brandLabel: "Mobile money",
      masked: maskSecretTail(settings.mobile_money_number),
      detail: settings.mobile_money_name,
    };
  }
  return { kind: "none", brandLabel: "No payment method added", masked: null, detail: null };
}

function invoicePaymentLabel(
  method: string | null,
  settings: PaymentSettings
): string | null {
  if (!method) return null;
  if (method === "bank_transfer") {
    const tail = maskSecretTail(settings.bank_account_number);
    return tail ? `Bank transfer ${tail}` : methodLabel(method);
  }
  if (method === "mobile_money") {
    const tail = maskSecretTail(settings.mobile_money_number);
    return tail ? `Mobile money ${tail}` : methodLabel(method);
  }
  return methodLabel(method);
}

export async function getCompanyBillingPageData(clientId: string): Promise<CompanyBillingPageData> {
  const supabase = createAdminClient();

  const [
    clientRes,
    subRes,
    invoiceRes,
    pendingRes,
    paymentsRes,
    receiptsRes,
    settingsRes,
    seatsRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, owner_email")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select(
        "id, plan, billing_cycle, amount, currency, status, current_period_start, current_period_end, cancelled_at, grace_days"
      )
      .eq("client_id", clientId)
      .eq("product", "crm")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, amount, currency, status, issued_at, due_at, paid_at, period_start, period_end, pdf_url, subscription_id"
      )
      .eq("client_id", clientId)
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("payments").select("invoice_id").eq("client_id", clientId).eq("status", "pending"),
    supabase
      .from("payments")
      .select("id, invoice_id, method, status, paid_at, confirmed_at")
      .eq("client_id", clientId)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false }),
    supabase.from("receipts").select("payment_id, pdf_url").eq("client_id", clientId),
    supabase
      .from("billing_settings")
      .select(
        "bank_name, bank_account_name, bank_account_number, bank_branch, swift, mobile_money_number, mobile_money_name, payment_instructions"
      )
      .limit(1)
      .maybeSingle(),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("role", "SALESPERSON")
      .eq("is_active", true),
  ]);

  const client = clientRes.data;
  const sub = subRes.error ? null : subRes.data;
  const invoiceRows = invoiceRes.error ? null : invoiceRes.data;
  const pending = pendingRes.data;
  const payments = paymentsRes.data;
  const receipts = receiptsRes.data;
  const settingsRow = settingsRes.error ? null : settingsRes.data;
  const salespersonCount = seatsRes.error ? null : seatsRes.count;

  const settings = (settingsRow as PaymentSettings | null) ?? EMPTY_SETTINGS;
  const pendingInvoiceIds = new Set((pending ?? []).map((p) => p.invoice_id as string));

  const paymentIdToInvoice = new Map<string, string>();
  const latestMethodByInvoice = new Map<string, string>();
  for (const row of payments ?? []) {
    const invoiceId = row.invoice_id as string;
    const paymentId = row.id as string;
    paymentIdToInvoice.set(paymentId, invoiceId);
    if (!latestMethodByInvoice.has(invoiceId)) {
      latestMethodByInvoice.set(invoiceId, row.method as string);
    }
  }

  const receiptByInvoice = new Map<string, string | null>();
  for (const row of receipts ?? []) {
    const invoiceId = paymentIdToInvoice.get(row.payment_id as string);
    if (invoiceId && !receiptByInvoice.has(invoiceId)) {
      receiptByInvoice.set(invoiceId, (row.pdf_url as string | null) ?? null);
    }
  }

  const planKey: CrmPlan | null = sub && isCrmPlan(sub.plan as string) ? (sub.plan as CrmPlan) : null;

  const invoices: CompanyBillingInvoice[] = (invoiceRows ?? []).map((i) => {
    const method = latestMethodByInvoice.get(i.id as string) ?? null;
    return {
      id: i.id as string,
      invoiceNumber: i.invoice_number as string,
      issuedAt: (i.issued_at as string | null) ?? null,
      dueAt: (i.due_at as string | null) ?? null,
      paidAt: (i.paid_at as string | null) ?? null,
      periodStart: (i.period_start as string | null) ?? null,
      periodEnd: (i.period_end as string | null) ?? null,
      status: i.status as string,
      planKey,
      planLabel: planLabel(sub?.plan as string | undefined),
      amount: Number(i.amount),
      currency: i.currency as string,
      paymentMethodLabel: invoicePaymentLabel(method, settings),
      pdfUrl: (i.pdf_url as string | null) ?? null,
      receiptPdfUrl: receiptByInvoice.get(i.id as string) ?? null,
      hasPendingPayment: pendingInvoiceIds.has(i.id as string),
    };
  });

  const subscription: CompanyBillingSubscription | null = sub
    ? {
        id: sub.id as string,
        plan: sub.plan as string,
        planKey,
        planLabel: planLabel(sub.plan as string),
        description: planKey ? CRM_PLAN_DESCRIPTIONS[planKey] : "Custom billing agreement.",
        features: planKey ? CRM_PLAN_FEATURES[planKey] : ["Custom commercial terms"],
        billingCycle: sub.billing_cycle as string,
        amount: Number(sub.amount),
        currency: sub.currency as string,
        status: sub.status as string,
        currentPeriodStart: (sub.current_period_start as string | null) ?? null,
        currentPeriodEnd: (sub.current_period_end as string | null) ?? null,
        cancelledAt: (sub.cancelled_at as string | null) ?? null,
        graceDays: Number(sub.grace_days ?? 7),
        graceEndsAt: null,
      }
    : null;

  if (subscription) {
    const overdue = invoices
      .filter((i) => i.status === "overdue" && i.dueAt)
      .sort((a, b) => new Date(a.dueAt as string).getTime() - new Date(b.dueAt as string).getTime())[0];
    if (overdue?.dueAt) {
      const due = new Date(overdue.dueAt);
      if (!Number.isNaN(due.getTime())) {
        due.setUTCDate(due.getUTCDate() + subscription.graceDays);
        subscription.graceEndsAt = due.toISOString();
      }
    }
  }

  const seatsUsed = salespersonCount ?? 0;
  const seatsLimit = planKey ? CRM_PLAN_SEATS[planKey] : null;
  const usage: CompanyBillingUsageMetric[] =
    subscription && !seatsRes.error
      ? [
          {
            id: "salespeople",
            label: "Team Members",
            used: seatsUsed,
            limit: seatsLimit,
            displayUsed: String(seatsUsed),
            displayLimit: seatsLimit == null ? "Unlimited" : String(seatsLimit),
            percent: usagePercent(seatsUsed, seatsLimit),
            unlimited: seatsLimit == null,
            atLimit: seatsLimit != null && seatsUsed >= seatsLimit,
          },
        ]
      : [];

  const outstanding = invoices
    .filter((i) => UNPAID.includes(i.status))
    .reduce((sum, i) => sum + i.amount, 0);

  return {
    clientId,
    companyName: (client?.name as string | null) ?? "Company",
    billingEmail: (client?.owner_email as string | null) ?? null,
    currency: subscription?.currency ?? invoices[0]?.currency ?? "USD",
    subscription,
    invoices,
    outstanding,
    usage,
    paymentSettings: settings,
    paymentMethod: paymentMethodDisplay(settings),
    capabilities: {
      canViewBilling: true,
      canManageSubscription: false,
      canManagePaymentMethods: true,
      canDownloadInvoices: true,
      canEditBillingInfo: true,
    },
    errors: {
      subscription: Boolean(subRes.error),
      usage: Boolean(seatsRes.error),
      invoices: Boolean(invoiceRes.error),
      paymentMethod: Boolean(settingsRes.error),
    },
    generatedAt: new Date().toISOString(),
  };
}
