import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SalesLeadsClient } from "@/components/sales/leads-directory/SalesLeadsClient";
import { Skeleton } from "@/components/sales/ui";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function LeadsFallback() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-28 rounded-[10px]" />
      </div>
      <Skeleton className="h-10 w-full max-w-3xl rounded-sales-md" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-sales-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <Skeleton className="h-[420px] rounded-sales-xl" />
        <div className="space-y-4">
          <Skeleton className="h-[220px] rounded-sales-xl" />
          <Skeleton className="h-[200px] rounded-sales-xl" />
          <Skeleton className="h-[220px] rounded-sales-xl" />
        </div>
      </div>
    </div>
  );
}

export default async function SalesLeadsDirectoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  let assignmentMode: "direct" | "pool" | "round_robin" = "direct";
  if (session.clientId) {
    const supabase = createAdminClient();
    const { data: client } = await supabase
      .from("clients")
      .select("assignment_mode")
      .eq("id", session.clientId)
      .maybeSingle();
    const raw = client?.assignment_mode as string | null | undefined;
    if (raw === "pool" || raw === "round_robin" || raw === "direct") assignmentMode = raw;
  }

  return (
    <Layout
      breadcrumb="SALES / LEADS"
      pageTitle="Leads"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        assignmentMode={assignmentMode}
        breadcrumb="Sales / Leads"
        title="Leads"
        description="All your inbound and captured leads in one place. Engage, qualify and convert."
        searchPlaceholder="Search leads, customers, quotes..."
      >
        <Suspense fallback={<LeadsFallback />}>
          <SalesLeadsClient
            assignmentMode={assignmentMode}
            repName={session.user?.name ?? ""}
          />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
