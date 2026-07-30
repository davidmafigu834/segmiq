import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientDetailView } from "../../ClientDetailView";
import { buildClientDetailHero } from "@/lib/client-hero";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { ProjectDetail } from "./ProjectDetail";

export default async function ProjectDetailPage({
  params,
}: {
  params: { clientId: string; projectId: string };
}) {
  const supabase = createAdminClient();
  const [{ data: client }, { data: clientProfile }, { data: project }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle(),
    supabase.from("client_profiles").select("is_published, slug").eq("client_id", params.clientId).maybeSingle(),
    supabase
      .from("projects")
      .select("*, project_media(*)")
      .eq("id", params.projectId)
      .eq("client_id", params.clientId)
      .maybeSingle(),
  ]);

  if (!client || !project) notFound();

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

  return (
    <AgencyLayout
      breadcrumb={`PLATFORM / CLIENTS / ${(client.name as string).toUpperCase()} / PROJECTS`}
      pageTitle={project.title as string}
    >
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        agencyManaged={Boolean((client as { agency_managed?: boolean | null }).agency_managed ?? true)}
        publicProfileUrl={publicProfileUrl}
        hero={hero}
      >
        <ProjectDetail
          clientId={params.clientId}
          project={project as unknown as ProjectFull}
        />
      </ClientDetailView>
    </AgencyLayout>
  );
}

type ProjectFull = {
  id: string;
  title: string;
  category: string | null;
  location: string | null;
  completion_date: string | null;
  description: string | null;
  is_featured: boolean;
  is_public: boolean;
  slug: string;
  display_order: number;
  project_media: {
    id: string;
    public_url: string;
    storage_key: string;
    caption: string | null;
    display_order: number;
  }[];
};
