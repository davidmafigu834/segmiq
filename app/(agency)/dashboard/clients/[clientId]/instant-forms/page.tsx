import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { DesktopOnlyGate } from "@/components/ui/DesktopOnlyGate";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientHeroContext } from "@/lib/client-hero";
import { ClientDetailView } from "../ClientDetailView";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { InstantFormsList } from "./InstantFormsList";
import type { InstantFormRow } from "@/types";

export default async function InstantFormsPage({ params }: { params: { clientId: string } }) {
  const supabase = createAdminClient();
  const ctx = await loadClientHeroContext(params.clientId);
  if (!ctx) notFound();
  const { client, hero } = ctx;

  const { data: forms } = await supabase
    .from("instant_forms")
    .select("id, name, slug, status, form_type, submission_count, created_at, updated_at")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  return (
    <AgencyLayout breadcrumb="AGENCY / INSTANT FORMS" pageTitle={client.name as string}>
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        publicProfileUrl={hero.profileSlug ? getPublicLandingPageUrl(hero.profileSlug) : null}
        hero={hero}
      >
        <DesktopOnlyGate
          title="Instant Forms needs a laptop"
          description="Building multi-screen forms works best on a wide screen. Open this on a laptop or desktop."
        >
          <InstantFormsList
            clientId={params.clientId}
            initialForms={(forms ?? []) as Pick<
              InstantFormRow,
              "id" | "name" | "slug" | "status" | "form_type" | "submission_count" | "created_at" | "updated_at"
            >[]}
          />
        </DesktopOnlyGate>
      </ClientDetailView>
    </AgencyLayout>
  );
}
