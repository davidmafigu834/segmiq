import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { DesktopOnlyGate } from "@/components/ui/DesktopOnlyGate";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientHeroContext } from "@/lib/client-hero";
import { FormBuilder } from "./FormBuilder";
import { ClientDetailView } from "../ClientDetailView";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import type { FormField } from "@/types";

export default async function FormBuilderPage({ params }: { params: { clientId: string } }) {
  const supabase = createAdminClient();
  const ctx = await loadClientHeroContext(params.clientId);
  if (!ctx) notFound();
  const { client, hero } = ctx;
  const { data: form } = await supabase.from("form_schemas").select("*").eq("client_id", params.clientId).maybeSingle();

  const initial = {
    fields: (form?.fields as FormField[] | null) ?? [],
    form_title: (form?.form_title as string | null) ?? "Contact",
    submit_button_text: (form?.submit_button_text as string | null) ?? "Submit",
    thank_you_message: (form?.thank_you_message as string | null) ?? "Thanks!",
    opening_message: (form?.opening_message as string | null) ?? "",
  };

  return (
    <AgencyLayout breadcrumb="AGENCY / FORM BUILDER" pageTitle={client.name as string}>
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        publicProfileUrl={hero.profileSlug ? getPublicLandingPageUrl(hero.profileSlug) : null}
        hero={hero}
      >
        <DesktopOnlyGate
          title="The form builder needs a laptop"
          description="Designing forms and field logic works best on a wide screen. Open this on a laptop or desktop."
        >
          <FormBuilder clientId={params.clientId} clientIndustry={String(client.industry ?? "")} initial={initial} />
        </DesktopOnlyGate>
      </ClientDetailView>
    </AgencyLayout>
  );
}
