import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";
import { listGrants, resolveApprovalMode } from "@/lib/security/support-access";
import {
  SupportAccessLogView,
  type SupportAccessLogRow,
} from "@/components/agency/support-access/SupportAccessLogView";

export const dynamic = "force-dynamic";

export default async function SupportAccessLogPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const authorised = hasPermission(
    {
      userId: session.userId,
      role: session.role,
      clientId: session.clientId ?? null,
      isImpersonating: Boolean(session.isImpersonating),
    },
    P.SUPPORT_ACCESS_AUDIT_READ
  );
  if (!authorised) redirect("/dashboard");

  const grants = await listGrants({
    clientId: searchParams.clientId ?? null,
    limit: 200,
  });

  const rows: SupportAccessLogRow[] = grants.map((g) => ({
    id: g.id,
    reference: g.reference,
    administrator: g.adminName,
    organisation: g.clientName,
    organisationId: g.clientId,
    status: g.status,
    accessKind: g.accessKind,
    scopes: g.scopes,
    reason: g.reason,
    ticketReference: g.ticketReference,
    durationMinutes: g.durationMinutes,
    requestedAt: g.requestedAt,
    startedAt: g.startedAt,
    expiresAt: g.expiresAt,
    revokedAt: g.revokedAt,
  }));

  return (
    <AgencyLayout breadcrumb="Security / Support Access" pageTitle="Support Access">
      <div className="space-y-6">
        <p className="max-w-[70ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Monitor privileged administrative activity across SegmiQ. Client business data is
          restricted by default. Approval policy:{" "}
          <span className="font-mono text-[12px] text-[var(--text-primary)]">
            {resolveApprovalMode()}
          </span>
          .
        </p>
        <SupportAccessLogView rows={rows} />
      </div>
    </AgencyLayout>
  );
}
