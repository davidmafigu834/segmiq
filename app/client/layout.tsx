import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyWorkspaceProvider } from "@/components/company/CompanyWorkspaceContext";
import { CompanyClientProviders } from "@/components/dashboard/company/CompanyClientProviders";
import { normalizeBusinessType } from "@/lib/terminology";

export const dynamic = "force-dynamic";

export default async function ClientRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let businessType: string = "trades";
  if (session?.clientId) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clients")
      .select("business_type")
      .eq("id", session.clientId)
      .maybeSingle();
    businessType = (data?.business_type as string) ?? "trades";
  }

  return (
    <CompanyWorkspaceProvider businessType={normalizeBusinessType(businessType)}>
      <CompanyClientProviders>{children}</CompanyClientProviders>
    </CompanyWorkspaceProvider>
  );
}
