import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { TeamInbox } from "@/components/inbox/TeamInbox";

export const dynamic = "force-dynamic";

export default async function ClientInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER") redirect("/login");
  if (!session.clientId) redirect("/login");

  const supabase = createAdminClient();
  const [{ data: salespeople }, { data: client }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name")
      .eq("client_id", session.clientId)
      .eq("role", "SALESPERSON")
      .eq("is_active", true),
    supabase.from("clients").select("name").eq("id", session.clientId).maybeSingle(),
  ]);

  const clientName = (client?.name as string) ?? "Your company";

  return (
    <ClientManagerLayout breadcrumbPage="INBOX" pageTitle="Team Inbox" hideShellHeader hideShellSidebar>
      <TeamInbox
        userName={session.user?.name ?? "Manager"}
        userId={session.userId}
        role="CLIENT_MANAGER"
        clientId={session.clientId}
        roleSubtitle={`Client manager · ${clientName}`}
        pipelineHref="/client/leads/pipeline"
        teamHref="/client/team"
        settingsHref="/client/account"
        inboxHref="/client/inbox"
        backHref="/client/dashboard"
        initialSalespeople={(salespeople ?? []) as { id: string; name: string }[]}
      />
    </ClientManagerLayout>
  );
}
