import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { IntelligenceHome } from "@/components/intelligence/IntelligenceHome";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER" && session.role !== "SUPER_ADMIN" && session.role !== "SALESPERSON") {
    redirect("/client");
  }
  return (
    <ClientManagerLayout pageTitle="Intelligence" breadcrumbPage="INTELLIGENCE" navClientId={session.clientId}>
      <IntelligenceHome />
    </ClientManagerLayout>
  );
}
