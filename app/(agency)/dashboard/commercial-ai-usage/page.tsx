import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AdminAiUsageClient } from "@/components/platform-ai-usage/AdminAiUsageClient";
import { platformAiUsageFlags } from "@/lib/platform-ai-usage/flags";
import { loadAiUsageOverviews } from "@/lib/platform-ai-usage/read-model";

export const dynamic = "force-dynamic";

export default async function CommercialAiUsagePage() {
  const session = await getServerSession(authOptions);
  if (
    !session?.userId ||
    session.role !== "SUPER_ADMIN" ||
    session.isImpersonating
  )
    redirect("/login");

  const rows = platformAiUsageFlags.reporting
    ? await loadAiUsageOverviews().catch(() => [])
    : [];
  return (
    <AgencyLayout breadcrumb="COMMERCIAL" pageTitle="AI Usage">
      <div className="space-y-5">
        {!platformAiUsageFlags.reporting ? (
          <div className="rounded-xl border border-[var(--warning)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
            Usage reporting is disabled. Shadow observations require an explicit
            organisation allowlist and do not create charges or quota credits.
          </div>
        ) : null}
        <AdminAiUsageClient rows={rows} />
      </div>
    </AgencyLayout>
  );
}
