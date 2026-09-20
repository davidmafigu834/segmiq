import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientDetailView } from "./ClientDetailView";
import { OrganisationOperationsTab } from "@/components/agency/OrganisationOperationsTab";
import { SupportAccessPanel } from "@/components/agency/support-access/SupportAccessPanel";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { buildClientDetailHero } from "@/lib/client-hero";
import { authOptions } from "@/lib/auth";
import { fetchOrganisationDiagnostics } from "@/lib/security/support-access/diagnostics";
import {
  effectiveGrantStatus,
  grantRemainingMs,
  resolveSupportAccess,
} from "@/lib/security/support-access";

export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const supabase = createAdminClient();
  const [{ data: client }, diagnostics] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, industry, mode, agency_managed, fb_form_id, fb_page_id, fb_page_name, fb_token_expired_at, twilio_whatsapp_override"
      )
      .eq("id", params.clientId)
      .maybeSingle(),
    fetchOrganisationDiagnostics(params.clientId),
  ]);
  if (!client || !diagnostics) notFound();

  const cid = params.clientId;

  const [{ data: clientProfile }, access] = await Promise.all([
    supabase
      .from("client_profiles")
      .select("is_published, slug")
      .eq("client_id", cid)
      .maybeSingle(),
    resolveSupportAccess({
      userId: session.userId,
      role: session.role,
      isImpersonating: Boolean(session.isImpersonating),
      clientId: cid,
    }),
  ]);

  const profileSlug = (clientProfile as { slug?: string } | null)?.slug ?? null;
  const profilePublished = Boolean(
    (clientProfile as { is_published?: boolean } | null)?.is_published
  );
  const publicProfileUrl = profileSlug ? getPublicLandingPageUrl(profileSlug) : null;

  const hero = buildClientDetailHero(
    {
      fb_form_id: client.fb_form_id as string | null,
      fb_page_id: client.fb_page_id as string | null,
      fb_page_name: client.fb_page_name as string | null,
      fb_token_expired_at: client.fb_token_expired_at as string | null,
      twilio_whatsapp_override: client.twilio_whatsapp_override as string | null,
    },
    profilePublished,
    profileSlug
  );

  const grant = access.grant;
  const grantStatus = grant ? effectiveGrantStatus(grant) : null;

  return (
    <AgencyLayout
      breadcrumb={`Organisations / ${client.name as string}`}
      pageTitle={client.name as string}
    >
      <ClientDetailView
        clientId={cid}
        name={client.name as string}
        industry={(client.industry as string) ?? ""}
        publicProfileUrl={publicProfileUrl}
        hero={hero}
        agencyManaged={Boolean(client.agency_managed ?? true)}
        organisationId={diagnostics.organisation.id}
        statusLabel={diagnostics.organisation.status}
        planLabel={diagnostics.organisation.plan ?? undefined}
      >
        <OrganisationOperationsTab
          diagnostics={diagnostics}
          supportAccess={
            <SupportAccessPanel
              organisationId={cid}
              organisationName={client.name as string}
              state={{
                granted: access.granted,
                grantId: grant?.id ?? null,
                reference: grant?.reference ?? null,
                scopes: access.granted ? access.grant.scopes : [],
                expiresAt: grant?.expiresAt ?? null,
                remainingMs: grant ? grantRemainingMs(grant) : 0,
                status: grantStatus,
                pendingApproval: grantStatus === "PENDING",
              }}
            />
          }
        />
      </ClientDetailView>
    </AgencyLayout>
  );
}
