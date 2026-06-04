import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CloudClientsClient, type CloudClientRow } from "./CloudClientsClient";

export const dynamic = "force-dynamic";

export default async function CloudClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    redirect("/dashboard");
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select(`
      id, name, plan, billing_period, payment_status, next_payment_date, payment_notes,
      created_at, is_active,
      users (id, name, email, role, created_at),
      projects (id, project_media (file_size_bytes))
    `)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false });

  const cloudClients = ((data ?? []) as CloudClientRow[]).filter((c) =>
    Array.isArray(c.users) && c.users.some((u: { role: string }) => u.role === "CLIENT_MANAGER")
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let projectRef = "";
  try {
    projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  } catch {}
  const supabaseDashboardBase = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/editor?table=clients`
    : "https://supabase.com/dashboard";

  return (
    <AgencyLayout
      breadcrumb="AGENCY / CLOUD SUBSCRIPTIONS"
      pageTitle="Cloud Subscriptions"
    >
      <CloudClientsClient
        initialClients={cloudClients}
        supabaseDashboardBase={supabaseDashboardBase}
      />
    </AgencyLayout>
  );
}
