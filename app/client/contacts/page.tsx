import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { HubTabs } from "@/components/client-contacts/HubTabs";
import { ClientContactsTable } from "@/components/client-contacts/ClientContactsTable";

export const dynamic = "force-dynamic";

export default async function ClientContactsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER" && session.role !== "AGENCY_ADMIN") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="CONTACTS" pageTitle="Customer Hub" hideShellHeader>
      <Suspense fallback={<div className="shimmer h-64 rounded-xl" />}>
        <div className="px-0">
          <HubTabs />
          <ClientContactsTable
            showLifecycleFilter
            heading="Contacts"
            subheading="everyone you've dealt with — leads and customers"
          />
        </div>
      </Suspense>
    </ClientManagerLayout>
  );
}
