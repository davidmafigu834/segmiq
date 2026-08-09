import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { EventCaptureClient } from "@/components/events/EventCaptureClient";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SalesEventCapturePage() {
  const session = await getServerSession(authOptions);
  if (!session || !canActAsSalesperson(session) || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const [{ data: client }, shell] = await Promise.all([
    supabase.from("clients").select("dial_code, name").eq("id", session.clientId).maybeSingle(),
    loadSalesShellProps(session),
  ]);

  const isSolo = session.clientMode === "solo";

  return (
    <SalesLayout
      breadcrumb="SALES / EVENT CAPTURE"
      pageTitle="Event Capture"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Tools"
        title="Event Capture"
        description="Log walk-ins and event enquiries into your pipeline."
        showQuickActions={false}
      >
        <EventCaptureClient
          clientId={session.clientId}
          dialCode={(client?.dial_code as string) || "263"}
          clientName={(client?.name as string) || "Your company"}
          homeHref={isSolo ? "/solo/dashboard" : "/sales/dashboard"}
        />
      </SalesAppShell>
    </SalesLayout>
  );
}
