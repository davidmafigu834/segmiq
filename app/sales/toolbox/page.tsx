import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SalesToolboxClient } from "@/components/sales/toolbox/SalesToolboxClient";
import { ToolboxHeaderSearch } from "@/components/sales/toolbox/ToolboxHeaderSearch";
import { Skeleton } from "@/components/sales/ui";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function ToolboxFallback() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[190px] rounded-sales-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[150px] rounded-sales-xl" />
        ))}
      </div>
    </div>
  );
}

export default async function SalesToolboxPage() {
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
      breadcrumb="SALES / TOOLBOX"
      pageTitle="Toolbox"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        assignmentMode={assignmentMode}
        breadcrumb="Sales / Toolbox"
        title="Toolbox"
        description="Quick tools to help you capture leads, follow up, create quotes and keep deals moving."
        showSearch={false}
        showQuickActions
        headerActions={
          <Suspense fallback={<Skeleton className="h-10 w-[260px] rounded-sales-md" />}>
            <ToolboxHeaderSearch />
          </Suspense>
        }
      >
        <Suspense fallback={<ToolboxFallback />}>
          <SalesToolboxClient assignmentMode={assignmentMode} />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
