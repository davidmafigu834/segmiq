import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientDetailView } from "../ClientDetailView";
import { buildClientDetailHero } from "@/lib/client-hero";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { TestimonialsManager } from "./TestimonialsManager";

export default async function TestimonialsPage({ params }: { params: { clientId: string } }) {
  const supabase = createAdminClient();
  const [{ data: client }, { data: clientProfile }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle(),
    supabase.from("client_profiles").select("is_published, slug").eq("client_id", params.clientId).maybeSingle(),
  ]);
  if (!client) notFound();

  const profileSlug = (clientProfile as { slug?: string } | null)?.slug ?? null;
  const profilePublished = Boolean((clientProfile as { is_published?: boolean } | null)?.is_published);
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

  const { data: testimonials } = await supabase
    .from("testimonials")
    .select("*")
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true });

  return (
    <AgencyLayout
      breadcrumb={`PLATFORM / CLIENTS / ${(client.name as string).toUpperCase()} / TESTIMONIALS`}
      pageTitle="Testimonials"
    >
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        agencyManaged={Boolean((client as { agency_managed?: boolean | null }).agency_managed ?? true)}
        publicProfileUrl={publicProfileUrl}
        hero={hero}
      >
        <TestimonialsManager
          clientId={params.clientId}
          clientName={client.name as string}
          initialTestimonials={(testimonials ?? []) as unknown as TestimonialRow[]}
        />
      </ClientDetailView>
    </AgencyLayout>
  );
}

type TestimonialRow = {
  id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  rating: number | null;
  photo_url: string | null;
  is_featured: boolean;
  display_order: number;
};
