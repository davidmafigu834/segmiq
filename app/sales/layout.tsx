import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyWorkspaceProvider } from "@/components/company/CompanyWorkspaceContext";

export const dynamic = "force-dynamic";

export default async function SalesRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let businessType: string | null = null;
  if (session?.clientId) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clients")
      .select("business_type")
      .eq("id", session.clientId)
      .maybeSingle();
    businessType = (data?.business_type as string | null) ?? null;
  }
  return (
    <CompanyWorkspaceProvider businessType={businessType}>{children}</CompanyWorkspaceProvider>
  );
}
