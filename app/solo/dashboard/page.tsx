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
import { SalesAppDownloadButton } from "@/components/sales/SalesAppDownloadButton";
import SoloDashboardMain from "./SoloDashboardMain";
import SalesDashboardSkeleton from "@/app/sales/dashboard/SalesDashboardSkeleton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SoloDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.role !== "SALESPERSON" || session.clientMode !== "solo" || !session.clientId) {
    redirect("/login");
  }

  const [data, billingData] = await Promise.all([
    fetchSoloDashboardData(session.userId, session.clientId),
    getClientBillingData(session.clientId),
  ]);
  const billingAlert = deriveSoloBillingAlert(billingData);

  return (
    <SoloLayout
      breadcrumb="SOLO / DASHBOARD"
      pageTitle="Dashboard"
      actions={<SalesAppDownloadButton />}
    >
      <Suspense fallback={<SalesDashboardSkeleton />}>
        {billingAlert ? (
          <Link
            href="/solo/billing"
            className={`mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
              billingAlert.urgent
                ? "border-[var(--warning-border)] bg-[var(--warning-muted)] hover:border-[var(--warning)]"
                : "border-[var(--border)] bg-[var(--surface-card)] hover:border-[var(--border-hover)]"
            }`}
          >
            <p className="text-[13px] text-[var(--text-secondary)]">{billingAlert.message}</p>
            <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--accent)]">
              View billing
              <ChevronRight size={14} />
            </span>
          </Link>
        ) : null}
        <SoloDashboardMain data={data} session={session} />
      </Suspense>
    </SoloLayout>
  );
}
