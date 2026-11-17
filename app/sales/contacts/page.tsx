import { getOperationalSession } from "@/lib/auth/operational-session";
import { canActAsSalesperson, fetchRoundRobinEligibleUsers } from "@/lib/auth/sales-capabilities";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SolarContacts } from "@/components/sales/solar/SolarContacts";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { companyUsesSolarWorkflow } from "@/lib/sales/solar-workflow/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SalesContactsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getOperationalSession();
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const solar = session.clientId ? await companyUsesSolarWorkflow(session.clientId) : false;
  if (!solar) redirect("/sales/leads");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);
  const supabase = createAdminClient();
  let assignmentMode: "direct" | "pool" | "round_robin" = "direct";
  if (session.clientId && !session.demoGuest) {
    const { data: client } = await supabase
      .from("clients")
      .select("assignment_mode")
      .eq("id", session.clientId)
      .maybeSingle();
    const raw = client?.assignment_mode as string | null | undefined;
    if (raw === "pool" || raw === "round_robin" || raw === "direct") assignmentMode = raw;
  }
  const { data } = session.clientId
    ? await fetchRoundRobinEligibleUsers(supabase, session.clientId, { select: "id, name" })
    : { data: [] };
  const team = ((data ?? []) as { id: string; name: string | null }[])
    .filter((person) => person.id && person.name)
    .map((person) => ({ id: person.id, name: person.name as string }));
  const contactParam = searchParams.contact;
  const initialContactId = typeof contactParam === "string" ? contactParam : undefined;

  return (
    <Layout breadcrumb="Sales / CONTACTS" pageTitle="Contacts" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell
        {...shell}
        assignmentMode={assignmentMode}
        breadcrumb="Sales / Contacts"
        title="Contacts"
        description="Every person in the account, with the number, the last touch, and where the job stands."
        showDefaultHeader={false}
        searchPlaceholder="Search contacts..."
      >
        <SolarContacts you={session.user?.name ?? ""} team={team} initialContactId={initialContactId} />
      </SalesAppShell>
    </Layout>
  );
}
