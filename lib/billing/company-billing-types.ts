import type { PaymentSettings } from "@/components/billing/HowToPay";
import type { CrmPlan } from "./plans";

export const COMPANY_BILLING_INVOICE_PAGE_SIZE = 5;

export type CompanyBillingCapabilities = {
  canViewBilling: boolean;
  canManageSubscription: boolean;
  canManagePaymentMethods: boolean;
  canDownloadInvoices: boolean;
  canEditBillingInfo: boolean;
};

export type CompanyBillingUsageMetric = {
  id: "salespeople";
  label: string;
  used: number;
  limit: number | null;
  displayUsed: string;
  displayLimit: string;
  percent: number | null;
  unlimited: boolean;
  atLimit: boolean;
};

export type CompanyBillingInvoice = {
  id: string;
  invoiceNumber: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  planKey: string | null;
  planLabel: string;
  amount: number;
  currency: string;
  paymentMethodLabel: string | null;
  pdfUrl: string | null;
  receiptPdfUrl: string | null;
  hasPendingPayment: boolean;
};

export type CompanyBillingSubscription = {
  id: string;
  plan: string;
  planKey: CrmPlan | null;
  planLabel: string;
  description: string;
  features: string[];
  billingCycle: string;
  amount: number;
  currency: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  graceDays: number;
  /** due_at of the oldest overdue invoice + grace_days, when past due. */
  graceEndsAt: string | null;
};

export type CompanyPaymentMethodDisplay = {
  kind: "bank_transfer" | "mobile_money" | "none";
  brandLabel: string;
  masked: string | null;
  detail: string | null;
};

export type CompanyBillingLoadErrors = {
  subscription: boolean;
  usage: boolean;
  invoices: boolean;
  paymentMethod: boolean;
};

export type CompanyBillingPageData = {
  clientId: string;
  companyName: string;
  billingEmail: string | null;
  currency: string;
  subscription: CompanyBillingSubscription | null;
  invoices: CompanyBillingInvoice[];
  outstanding: number;
  usage: CompanyBillingUsageMetric[];
  paymentSettings: PaymentSettings;
  paymentMethod: CompanyPaymentMethodDisplay;
  capabilities: CompanyBillingCapabilities;
  errors: CompanyBillingLoadErrors;
  generatedAt: string;
};
