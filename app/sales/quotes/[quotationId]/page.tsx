import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { QuotationWorkspace } from "@/components/sales/quotes/workspace/QuotationWorkspace";
import { Skeleton } from "@/components/sales/ui";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { loadQuotationWorkspace } from "@/lib/quotations/workspace-data";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function WorkspaceFallback() {
  return (
    <div className="space-y-4 p-1">
      <Skeleton className="h-16 w-full rounded-sales-md" />
      <Skeleton className="h-10 w-full rounded-sales-md" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-[480px] rounded-sales-md" />
        <Skeleton className="h-[480px] rounded-sales-md" />
      </div>
    </div>
  );
}

export default async function SalesQuoteWorkspacePage({
  params,
}: {
  params: { quotationId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const access = await canManageQuotation(params.quotationId);
  if (!access.allowed) {
    if (access.status === 404) notFound();
    redirect("/sales/quotes");
  }

  const supabase = createAdminClient();
  const initial = await loadQuotationWorkspace(supabase, params.quotationId, {
    role: access.actor.role,
    userId: access.actor.id,
  });

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);
  const number = initial?.quotation.quote_number
    ? `Quotations / ${initial.quotation.quote_number}`
    : "Quotations / Draft";

  return (
    <Layout
      breadcrumb="SALES / QUOTATIONS"
      pageTitle="Quotation"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Quotations"
        title={number}
        description="Build the commercial offer attached to the Deal."
        searchPlaceholder="Search leads, customers, quotes..."
      >
        <Suspense fallback={<WorkspaceFallback />}>
          <QuotationWorkspace quotationId={params.quotationId} initial={initial} />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
