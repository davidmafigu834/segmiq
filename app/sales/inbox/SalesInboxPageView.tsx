import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { TeamInbox } from "@/components/inbox/TeamInbox";
import type { InboxFilter } from "@/lib/inbox/types";

export async function SalesInboxPageView({
  pageTitle,
  breadcrumb,
  initialFilter = "all",
  fullPage = false,
}: {
  pageTitle: string;
  breadcrumb: string;
  initialFilter?: InboxFilter;
  fullPage?: boolean;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");
  if (!session.clientId) redirect("/login");

  const isSolo = session.clientMode === "solo";
  const dashboardHref = isSolo ? "/solo/dashboard" : "/sales/dashboard";
  const Layout = isSolo ? SoloLayout : SalesLayout;

  return (
    <Layout
      breadcrumb={breadcrumb}
      pageTitle={pageTitle}
      hideShellHeader={fullPage}
      contentFlush={fullPage}
    >
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">Loading inbox…</div>}>
        <TeamInbox
          userName={session.user?.name ?? "User"}
          userId={session.userId}
          role={session.role === "CLIENT_MANAGER" ? "CLIENT_MANAGER" : "SALESPERSON"}
          alsoSells={session.alsoSells}
          clientId={session.clientId}
          roleSubtitle={isSolo ? "Owner" : "Salesperson"}
          pipelineHref="/sales/leads"
          settingsHref="/sales/profile"
          inboxHref="/sales/inbox"
          teamHref={isSolo ? undefined : dashboardHref}
          initialFilter={initialFilter}
          backHref={fullPage ? dashboardHref : undefined}
        />
      </Suspense>
    </Layout>
  );
}
