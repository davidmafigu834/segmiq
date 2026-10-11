import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyWorkspaceProvider } from "@/components/company/CompanyWorkspaceContext";
import { CompanyClientProviders } from "@/components/dashboard/company/CompanyClientProviders";
import { normalizeBusinessType } from "@/lib/terminology";
import { isSalesWorkflowPreset } from "@/lib/sales/solar-workflow/types";

export const dynamic = "force-dynamic";

export default async function ClientRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let businessType: string = "trades";
  let solarWorkflow = false;
  if (session?.clientId) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clients")
      .select("business_type, sales_workflow_preset")
      .eq("id", session.clientId)
      .maybeSingle();
    businessType = (data?.business_type as string) ?? "trades";
    const preset = (data as { sales_workflow_preset?: string | null } | null)?.sales_workflow_preset;
    solarWorkflow = isSalesWorkflowPreset(preset) && preset === "SOLAR_INSTALLATION";
  }

  return (
    <CompanyWorkspaceProvider businessType={normalizeBusinessType(businessType)} solarWorkflow={solarWorkflow}>
      <CompanyClientProviders>{children}</CompanyClientProviders>
    </CompanyWorkspaceProvider>
  );
}
