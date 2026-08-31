import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { MarketingHubTabs } from "@/components/marketing/MarketingHubTabs";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { CompanyMarketingChildPage } from "@/components/real-estate/marketing/CompanyMarketingChildPage";
import { loadRealEstateMarketingChildChrome } from "@/lib/real-estate/marketing-child-chrome";

export default async function MarketingAudiencesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  const supabase = createAdminClient();
  const { data: segments } = await supabase
    .from("audience_segments")
    .select("id, name, description, segment_type, predefined_key, is_active")
    .eq("client_id", session.clientId)
    .eq("is_active", true)
    .order("segment_type", { ascending: false })
    .order("created_at", { ascending: true });

  const body = (
    <>
      <MarketingHubTabs />
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Audiences</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          CRM segments used to target WhatsApp campaigns. Segments are shared with Meta Ads export.
        </p>
      </div>
      <div className="space-y-2">
        {(segments ?? []).map((seg) => (
          <div
            key={seg.id as string}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">{seg.name as string}</p>
            {seg.description && (
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">{seg.description as string}</p>
            )}
            <p className="mt-1 text-xs capitalize text-[var(--text-tertiary)]">
              {seg.segment_type as string}
              {seg.predefined_key ? ` · ${seg.predefined_key as string}` : ""}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--text-tertiary)]">
        Custom segments can be created by Segmiq. Use these audiences when creating a{" "}
        <Link href="/client/marketing/campaigns/new" className="text-[var(--accent)] hover:underline">
          new campaign
        </Link>
        .
      </p>
    </>
  );

  const chrome = await loadRealEstateMarketingChildChrome({
    userId: session.userId,
    clientId: session.clientId,
    userName: session.user?.name ?? "User",
    role: session.role,
  });

  if (chrome) {
    return (
      <ClientManagerLayout breadcrumbPage="Audiences" pageTitle="Marketing" hideShellHeader hideShellSidebar>
        <CompanyMarketingChildPage
          chrome={chrome}
          title="Audiences"
          description="CRM segments used to target WhatsApp campaigns."
        >
          {body}
        </CompanyMarketingChildPage>
      </ClientManagerLayout>
    );
  }

  return (
    <ClientManagerLayout breadcrumbPage="Audiences" pageTitle="Marketing Hub" workspaceShell>
      {body}
    </ClientManagerLayout>
  );
}
