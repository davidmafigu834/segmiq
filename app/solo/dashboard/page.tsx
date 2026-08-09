import { Suspense } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { fetchSoloDashboardData } from "@/lib/dashboard-data";
import { getClientBillingData } from "@/lib/billing/client-billing-data";
import { deriveSoloBillingAlert } from "@/lib/billing/solo-billing-alert";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import SoloDashboardMain from "./SoloDashboardMain";
import SalesDashboardSkeleton from "@/app/sales/dashboard/SalesDashboardSkeleton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SoloDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.role !== "SALESPERSON" || session.clientMode !== "solo" || !session.clientId) {
    redirect("/login");
  }

  const [data, billingData, shell] = await Promise.all([
    fetchSoloDashboardData(session.userId, session.clientId),
    getClientBillingData(session.clientId),
    loadSalesShellProps(session),
  ]);
  const billingAlert = deriveSoloBillingAlert(billingData);
  const firstName = session.user?.name?.split(" ")[0] ?? "there";

  return (
    <SoloLayout
      breadcrumb="SOLO / DASHBOARD"
      pageTitle="Dashboard"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Solo / Dashboard"
        title={`Good day, ${firstName}`}
        description="Your pipeline priorities for today."
      >
        <Suspense fallback={<SalesDashboardSkeleton />}>
          {billingAlert ? (
            <Link
              href="/solo/billing"
              className={`mb-2 flex items-center justify-between gap-3 rounded-sales-xl border px-4 py-3 transition-colors ${
                billingAlert.urgent
                  ? "border-sales-warning/40 bg-sales-warning-soft hover:border-sales-warning"
                  : "border-sales-border bg-sales-surface hover:border-sales-border-strong"
              }`}
            >
              <p className="text-[13px] text-sales-text-secondary">{billingAlert.message}</p>
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-sales-brand-fg">
                View billing
                <ChevronRight size={14} />
              </span>
            </Link>
          ) : null}
          <SoloDashboardMain data={data} session={session} />
        </Suspense>
      </SalesAppShell>
    </SoloLayout>
  );
}
