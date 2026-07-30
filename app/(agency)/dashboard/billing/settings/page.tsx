import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { BillingSettingsClient, type BillingSettingsValues } from "@/components/billing/BillingSettingsClient";

export const dynamic = "force-dynamic";

const EMPTY: BillingSettingsValues = {
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_branch: "",
  swift: "",
  mobile_money_number: "",
  mobile_money_name: "",
  payment_instructions: "",
};

export default async function BillingSettingsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("billing_settings")
    .select(
      "bank_name, bank_account_name, bank_account_number, bank_branch, swift, mobile_money_number, mobile_money_name, payment_instructions"
    )
    .limit(1)
    .maybeSingle();

  const values: BillingSettingsValues = {
    bank_name: (data?.bank_name as string | null) ?? "",
    bank_account_name: (data?.bank_account_name as string | null) ?? "",
    bank_account_number: (data?.bank_account_number as string | null) ?? "",
    bank_branch: (data?.bank_branch as string | null) ?? "",
    swift: (data?.swift as string | null) ?? "",
    mobile_money_number: (data?.mobile_money_number as string | null) ?? "",
    mobile_money_name: (data?.mobile_money_name as string | null) ?? "",
    payment_instructions: (data?.payment_instructions as string | null) ?? "",
  };

  return (
    <AgencyLayout breadcrumb="PLATFORM / BILLING / SETTINGS" pageTitle="Billing settings" titleSize="hero">
      <BillingSettingsClient initial={data ? values : EMPTY} />
    </AgencyLayout>
  );
}
