import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { TemplateManager } from "@/components/marketing/TemplateManager";

export default async function MarketingTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="Templates" pageTitle="Marketing Hub" workspaceShell>
      <TemplateManager clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
