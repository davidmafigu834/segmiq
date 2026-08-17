import { createAdminClient } from "@/lib/supabase/admin";
import { CRM_PLAN_SEATS, isCrmPlan, planLabel, type CrmPlan } from "@/lib/billing/plans";
import { billingCycleLabel } from "@/lib/billing/status";
import { DEFAULT_MARKETING_SETTINGS } from "@/lib/marketing/settings";
import { fetchClientBaselineSettings } from "@/lib/sales/intelligence/daily-plan-service";
import { resolveOperatingHours } from "@/lib/sales/intelligence/operating-hours";
import type {
  CompanyAccountSummary,
  CompanyOperatingHours,
  CompanySettingsPageData,
  CompanySettingsProfile,
  CompanySettingsQuote,
} from "./company-settings-types";

export async function getCompanySettingsPageData(
  clientId: string,
  currentUser: CompanySettingsPageData["currentUser"]
): Promise<CompanySettingsPageData> {
  const supabase = createAdminClient();
  const [clientRes, quoteRes, subRes, seatsRes, marketingRes, adminRes, hoursSettings] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, industry, slug, logo_url, primary_color, response_time_limit_hours, dial_code, website, country, owner_email, assignment_mode, business_type, capability_tagline, years_in_operation, fb_page_id, fb_page_name, agency_managed"
      )
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("quotation_settings")
      .select("company_address, company_email, company_website, company_phone, footer_note, default_terms, quote_prefix, default_tax_rate")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan, billing_cycle, amount, currency, status, current_period_end")
      .eq("client_id", clientId)
      .eq("product", "crm")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("role", "SALESPERSON")
      .eq("is_active", true),
    supabase.from("client_marketing_settings").select("timezone").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("users")
      .select("name, email, phone")
      .eq("role", "SUPER_ADMIN")
      .eq("is_active", true)
      .limit(1),
    fetchClientBaselineSettings(clientId),
  ]);

  const c = clientRes.data;
  const profile: CompanySettingsProfile = {
    id: clientId,
    name: (c?.name as string | null) ?? "Company",
    industry: (c?.industry as string | null) ?? null,
    slug: (c?.slug as string | null) ?? "",
    logoUrl: (c?.logo_url as string | null) ?? null,
    primaryColor: (c?.primary_color as string | null) ?? null,
    responseTimeLimitHours: Number(c?.response_time_limit_hours ?? 2),
    dialCode: (c?.dial_code as string | null) ?? null,
    website: (c?.website as string | null) ?? null,
    country: (c?.country as string | null) ?? null,
    ownerEmail: (c?.owner_email as string | null) ?? null,
    assignmentMode: (c?.assignment_mode as string | null) ?? "direct",
    businessType: (c?.business_type as string | null) ?? "trades",
    capabilityTagline: (c?.capability_tagline as string | null) ?? null,
    yearsInOperation: c?.years_in_operation == null ? null : Number(c.years_in_operation),
    facebookPageName: (c?.fb_page_name as string | null) ?? null,
    facebookConnected: Boolean(c?.fb_page_id),
    agencyManaged: Boolean(c?.agency_managed ?? true),
  };

  const q = quoteRes.data;
  const quote: CompanySettingsQuote = {
    company_address: (q?.company_address as string | null) ?? null,
    company_email: (q?.company_email as string | null) ?? null,
    company_website: (q?.company_website as string | null) ?? null,
    company_phone: (q?.company_phone as string | null) ?? null,
    footer_note: (q?.footer_note as string | null) ?? null,
    default_terms: (q?.default_terms as string | null) ?? null,
    quote_prefix: (q?.quote_prefix as string | null) ?? "Q",
    default_tax_rate: Number(q?.default_tax_rate ?? 0),
  };

  const sub = subRes.error ? null : subRes.data;
  const planKey: CrmPlan | null = sub && isCrmPlan(sub.plan as string) ? (sub.plan as CrmPlan) : null;
  const account: CompanyAccountSummary | null = sub
    ? {
        planLabel: planLabel(sub.plan as string),
        status: sub.status as string,
        billingCycle: billingCycleLabel(sub.billing_cycle as string),
        nextBillingDate: (sub.current_period_end as string | null) ?? null,
        teamUsed: seatsRes.count ?? 0,
        teamLimit: planKey ? CRM_PLAN_SEATS[planKey] : null,
        amount: Number(sub.amount),
        currency: sub.currency as string,
      }
    : null;

  const admin = adminRes.data?.[0] as { name?: string; email?: string; phone?: string | null } | undefined;
  const operatingHours: CompanyOperatingHours = resolveOperatingHours(hoursSettings);

  return {
    clientId,
    profile,
    quote,
    timezone: (marketingRes.data?.timezone as string | null) ?? DEFAULT_MARKETING_SETTINGS.timezone,
    operatingHours,
    account: subRes.error ? null : account,
    currentUser,
    agencyContact: admin
      ? {
          name: admin.name ?? "SegmiQ",
          email: admin.email ?? "",
          phone: admin.phone ?? null,
        }
      : null,
    errors: {
      profile: Boolean(clientRes.error),
      quote: Boolean(quoteRes.error),
      account: Boolean(subRes.error),
    },
  };
}
