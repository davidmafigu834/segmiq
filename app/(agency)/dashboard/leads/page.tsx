import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { EmptyState } from "@/components/ui";
import { isSuperAdminRole } from "@/lib/auth/roles";

/**
 * Cross-tenant lead browsing has been removed from platform administration.
 *
 * A SegmiQ administrator should not be able to page through every organisation's
 * customers. Lead records are reachable only inside an organisation that has an
 * active Support Access grant with the LEADS scope, and the APIs enforce that
 * independently of this page.
 */
export default async function AllLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isSuperAdminRole(session.role) || session.isImpersonating) {
    redirect("/login");
  }

  return (
    <AgencyLayout breadcrumb="Security" pageTitle="Restricted data">
      <div className="rounded-lg border border-[var(--border)]">
        <EmptyState
          icon={Lock}
          title="Client business data is restricted"
          description="Super Admin provides operational access by default. Use Support Access when customer-data access is legitimately required."
          action={
            <Link
              href="/dashboard/support-access"
              className="text-[13px] font-medium text-[var(--text-primary)] hover:underline"
            >
              Request Support Access
            </Link>
          }
        />
      </div>
    </AgencyLayout>
  );
}
