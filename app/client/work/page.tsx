import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { MyWorkClient } from "@/components/work-projects/MyWorkClient";
import { listMyWork } from "@/lib/work-projects/field-service";
import { tradesProjectActor } from "@/lib/work-projects/page-data";

export const dynamic = "force-dynamic";

export default async function ClientMyWorkPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role === "SALESPERSON") redirect("/sales/work");
  const actor = await tradesProjectActor();
  const work = await listMyWork(actor);
  const data = work.ok ? work.data : { tasks: [], visits: [] };
  return (
    <ClientManagerLayout breadcrumbPage="MY WORK" pageTitle="My work" workspaceShell workspaceTitle="My work" workspaceDescription="Visits and tasks assigned to you.">
      <MyWorkClient tasks={data.tasks} visits={data.visits} basePath="/client/projects" />
    </ClientManagerLayout>
  );
}
