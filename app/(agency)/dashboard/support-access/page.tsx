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
import { RecordFrame } from "@/components/platform/workbench";

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
      <RecordFrame
        detail={`Client business data stays restricted. Approval policy: ${resolveApprovalMode()}.`}
        fact={{
          name: rows.find((row) => row.status === "ACTIVE")
            ? `${rows.find((row) => row.status === "ACTIVE")?.organisation ?? "An organisation"} has an open session.`
            : "No support session is open.",
          detail: "Open the organisation only while the session is active.",
          action: rows.find((row) => row.status === "ACTIVE")?.organisationId ? "Open organisation" : "Open organisations",
          href: rows.find((row) => row.status === "ACTIVE")?.organisationId
            ? `/dashboard/clients/${rows.find((row) => row.status === "ACTIVE")?.organisationId}`
            : "/dashboard/clients",
        }}
      >
        <SupportAccessLogView rows={rows} />
      </RecordFrame>
    </AgencyLayout>
  );
}
