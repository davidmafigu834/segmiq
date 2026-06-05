import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ClientReportsPageClient } from "./ClientReportsPageClient";

export default async function ClientReportsPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  const supabase = createAdminClient();
  const id = searchParams.clientId ?? session?.clientId ?? null;
  let clientName = "Your company";
  if (id) {
    const { data } = await supabase.from("clients").select("name").eq("id", id).maybeSingle();
    if (data?.name) clientName = data.name as string;
  }

  return (
    <ClientManagerLayout
      hideShellHeader
      navClientId={id ?? undefined}
      breadcrumbOverride={id ? `${clientName} / REPORTS` : "REPORTS"}
      pageTitle="Performance"
    >
      <Suspense fallback={<div className="shimmer h-[min(480px,70vh)] rounded-xl" />}>
        <ClientReportsPageClient clientName={clientName} />
      </Suspense>
    </ClientManagerLayout>
  );
}
