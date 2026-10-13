import { getOperationalSession } from "@/lib/auth/operational-session";
import { readPinnedDemoWorkspace } from "@/lib/demo/workspace-lookup";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyWorkspaceProvider } from "@/components/company/CompanyWorkspaceContext";
import { isSalesWorkflowPreset } from "@/lib/sales/solar-workflow/types";

export const dynamic = "force-dynamic";

export default async function SalesRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getOperationalSession();
  let businessType: string | null = null;
  let solarWorkflow = false;
  if (session?.demoGuest && session.clientId) {
    const pinned = await readPinnedDemoWorkspace(session.clientId);
    businessType = pinned?.businessType ?? null;
    solarWorkflow = isSalesWorkflowPreset(pinned?.salesWorkflowPreset) && pinned?.salesWorkflowPreset === "SOLAR_INSTALLATION";
  } else if (session?.clientId) {
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
