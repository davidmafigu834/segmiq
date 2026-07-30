import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { DesktopOnlyGate } from "@/components/ui/DesktopOnlyGate";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientHeroContext } from "@/lib/client-hero";
import { ClientDetailView } from "../../ClientDetailView";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { InstantFormBuilder } from "./InstantFormBuilder";
import type { InstantFormRow } from "@/types";

export default async function InstantFormEditorPage({
  params,
}: {
  params: { clientId: string; formId: string };
}) {
  const supabase = createAdminClient();
  const ctx = await loadClientHeroContext(params.clientId);
  if (!ctx) notFound();
  const { client, hero } = ctx;

  const { data: form } = await supabase
    .from("instant_forms")
    .select("*")
    .eq("id", params.formId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (!form) notFound();

  return (
    <AgencyLayout breadcrumb="PLATFORM / INSTANT FORM EDITOR" pageTitle={client.name as string}>
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        agencyManaged={Boolean((client as { agency_managed?: boolean | null }).agency_managed ?? true)}
        publicProfileUrl={hero.profileSlug ? getPublicLandingPageUrl(hero.profileSlug) : null}
        hero={hero}
      >
        <DesktopOnlyGate
          title="The form editor needs a laptop"
          description="Designing instant forms works best on a wide screen."
        >
          <InstantFormBuilder
            clientId={params.clientId}
            clientName={client.name as string}
            clientLogo={(client.logo_url as string | null) ?? undefined}
            initial={form as unknown as InstantFormRow}
          />
        </DesktopOnlyGate>
      </ClientDetailView>
    </AgencyLayout>
  );
}
