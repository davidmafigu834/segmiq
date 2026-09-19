import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { SocialInboxSalesHost } from "@/components/social-inbox/SocialInboxWorkspace";
import { Skeleton } from "@/components/sales/ui";

export const dynamic = "force-dynamic";

function Fallback() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-sales-bg p-4" aria-busy aria-label="Loading Social Inbox">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="hidden w-[320px] shrink-0 border-r border-sales-border p-3 layout:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-16 w-full" />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-sales-text-muted">
          Loading Social Inbox…
        </div>
      </div>
    </div>
  );
}

export default async function SalesSocialInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");
  if (!session.clientId) redirect("/login");

  const shell = await loadSalesShellProps(session);

  return (
    <Suspense fallback={<Fallback />}>
      <SocialInboxSalesHost
        userName={shell.userName}
        userRoleLabel={shell.userRoleLabel}
        avatarUrl={shell.avatarUrl}
        unreadNotifications={shell.unreadNotifications}
        notificationRole={shell.notificationRole}
        whatsappBadge={shell.whatsappBadge}
        tasksBadge={shell.tasksBadge}
        isSolo={shell.isSolo}
        quotesBase="/sales/quotes?leadId="
        leadsBase="/sales/leads?lead="
        dealsBase="/sales/deals/"
        channelsHref="/client/settings/integrations/channels"
      />
    </Suspense>
  );
}
