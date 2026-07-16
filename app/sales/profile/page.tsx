import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesProfileClient } from "@/components/sales/SalesProfileClient";

export default async function SalesProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  return (
    <SalesLayout breadcrumb="SALES / PROFILE" pageTitle="Profile">
      <SalesProfileClient initialEmail={session.user.email} />
    </SalesLayout>
  );
}
