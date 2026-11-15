import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AdminAiUsageClient } from "@/components/platform-ai-usage/AdminAiUsageClient";
import { RecordFrame } from "@/components/platform/workbench";
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
      <RecordFrame
        detail="Usage is a record. A shadow observation does not create a charge or a quota credit."
        fact={platformAiUsageFlags.reporting ? {
          name: rows.length ? `${rows.length} organisations have usage on the register.` : "No usage is recorded.",
          detail: "Open top-ups only when a customer has approved a pack.",
          action: "Open top-ups",
          href: "/dashboard/commercial-topups",
        } : {
          name: "Usage reporting is closed.",
          detail: "Shadow observations need an explicit organisation allowlist. They do not create charges.",
          action: "Open commercial",
          href: "/dashboard/commercial",
        }}
      >
        <AdminAiUsageClient rows={rows} />
      </RecordFrame>
    </AgencyLayout>
  );
}
