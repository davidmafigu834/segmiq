import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesReportsClient } from "@/components/sales/SalesReportsClient";

export const dynamic = "force-dynamic";

export default async function SalesReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SALESPERSON") redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;

  return (
    <Layout breadcrumb="SALES / WHATSAPP SALES HUB / REPORTS" pageTitle="Reports">
      <SalesReportsClient />
    </Layout>
  );
}
