import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { WhatsAppConnectionSettings } from "@/components/client-settings/WhatsAppConnectionSettings";

export default async function CompanyWhatsAppSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }
  return (
    <ClientManagerLayout breadcrumbPage="WHATSAPP" pageTitle="WhatsApp connection" hideShellHeader>
      <WhatsAppConnectionSettings />
    </ClientManagerLayout>
  );
}
