import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagerPrefs } from "@/lib/notification-prefs";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ClientAccountClient } from "@/components/client/ClientAccountClient";

export default async function ClientAccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, phone, avatar_url, notification_prefs, role, client_id")
    .eq("id", session.userId)
    .single();

  if (error || !user) {
    redirect("/login");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, industry, logo_url")
    .eq("id", session.clientId)
    .single();

  const { data: agencyAdmins } = await supabase
    .from("users")
    .select("name, email, phone")
    .eq("role", "AGENCY_ADMIN")
    .eq("is_active", true)
    .limit(1);

  const prefs = getManagerPrefs((user as { notification_prefs?: unknown }).notification_prefs);

  return (
    <ClientManagerLayout breadcrumbPage="ACCOUNT" pageTitle="Your account" hideShellHeader>
      <ClientAccountClient
        user={{
          id: user.id as string,
          name: user.name as string,
          email: user.email as string,
          phone: (user.phone as string | null) ?? null,
          avatar_url: (user.avatar_url as string | null) ?? null,
          notification_prefs: prefs,
        }}
        agencyContact={(agencyAdmins?.[0] as { name: string; email: string; phone: string | null } | null) ?? null}
        client={
          client ?? {
            id: session.clientId,
            name: "Client",
            industry: null,
            logo_url: null,
          }
        }
      />
    </ClientManagerLayout>
  );
}
