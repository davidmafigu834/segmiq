import { createAdminClient } from "@/lib/supabase/admin";
import { isRealEstate } from "@/lib/terminology";
import { loadCompanyPageChrome, type CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import type { UserRole } from "@/types";

export async function loadRealEstateMarketingChildChrome(opts: {
  userId: string;
  clientId: string;
  userName: string;
  role: UserRole;
}): Promise<CompanyPageChrome | null> {
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", opts.clientId)
    .maybeSingle();
  if (!isRealEstate((client as { business_type?: string } | null)?.business_type)) return null;
  return loadCompanyPageChrome(opts);
}
