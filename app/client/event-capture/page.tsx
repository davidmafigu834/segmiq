import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { EventCaptureClient } from "@/components/events/EventCaptureClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClientEventCapturePage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId || session.role !== "CLIENT_MANAGER") {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("dial_code, name")
    .eq("id", session.clientId)
    .maybeSingle();

  return (
    <ClientManagerLayout
      breadcrumbPage="EVENT CAPTURE"
      pageTitle="Event Capture"
      workspaceShell
    >
      <EventCaptureClient
        clientId={session.clientId}
        dialCode={(client?.dial_code as string) || "263"}
        clientName={(client?.name as string) || "Your company"}
        homeHref="/client/leads"
      />
    </ClientManagerLayout>
  );
}
