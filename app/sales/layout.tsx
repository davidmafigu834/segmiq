import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyWorkspaceProvider } from "@/components/company/CompanyWorkspaceContext";
import { isSalesWorkflowPreset } from "@/lib/sales/solar-workflow/types";

export const dynamic = "force-dynamic";

export default async function SalesRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let businessType: string | null = null;
  let solarWorkflow = false;
  if (session?.clientId) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clients")
      .select("business_type, sales_workflow_preset")
      .eq("id", session.clientId)
      .maybeSingle();
    businessType = (data?.business_type as string | null) ?? null;
    const preset = (data as { sales_workflow_preset?: string | null } | null)?.sales_workflow_preset;
    solarWorkflow = isSalesWorkflowPreset(preset) && preset === "SOLAR_INSTALLATION";
  }
  return (
    <CompanyWorkspaceProvider businessType={businessType} solarWorkflow={solarWorkflow}>
      {children}
    </CompanyWorkspaceProvider>
  );
}
