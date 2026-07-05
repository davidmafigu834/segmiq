import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { TeamInbox } from "@/components/inbox/TeamInbox";

export const dynamic = "force-dynamic";

export default async function SalesInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SALESPERSON") redirect("/login");
  if (!session.clientId) redirect("/login");

  const isSolo = session.clientMode === "solo";
  const dashboardHref = isSolo ? "/solo/dashboard" : "/sales/dashboard";
  const Layout = isSolo ? SoloLayout : SalesLayout;

  const inbox = (
    <TeamInbox
      userName={session.user?.name ?? "User"}
      userId={session.userId}
      role="SALESPERSON"
      clientId={session.clientId}
      roleSubtitle={isSolo ? "Owner" : "Salesperson"}
      pipelineHref="/sales/leads"
      settingsHref="/sales/profile"
      inboxHref="/sales/inbox"
      teamHref={isSolo ? undefined : dashboardHref}
    />
  );

  return (
    <Layout breadcrumb="SALES / INBOX" pageTitle="Team Inbox" hideShellHeader hideShellSidebar>
      {inbox}
    </Layout>
  );
}
