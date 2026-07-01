import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { PublicInstantForm } from "@/components/instant-form/PublicInstantForm";
import type {
  InstantFormCompletion,
  InstantFormConsent,
  InstantFormIntro,
  InstantFormPrivacy,
  InstantFormQuestion,
  InstantFormType,
} from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data: form } = await supabase
    .from("instant_forms")
    .select("name, intro, clients(name)")
    .eq("slug", params.slug)
    .eq("status", "published")
    .maybeSingle();

  if (!form) return { title: "Form" };

  const clientName = (form.clients as { name?: string } | null)?.name ?? "Company";
  const intro = (form.intro as InstantFormIntro | null) ?? {};
  const title = intro.headline || (form.name as string) || clientName;

  return {
    title,
    robots: { index: false, follow: false },
  };
}

export default async function InstantFormPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient();

  const { data: form } = await supabase
    .from("instant_forms")
    .select(
      "id, client_id, name, slug, form_type, intro, questions, consents, privacy, completion, clients(id, name, logo_url, is_active, is_archived)"
    )
    .eq("slug", params.slug)
    .eq("status", "published")
    .maybeSingle();

  if (!form) notFound();

  const clientRaw = form.clients;
  const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as {
    id: string;
    name: string;
    logo_url: string | null;
    is_active?: boolean;
    is_archived?: boolean;
  } | null;

  if (!client || client.is_archived || client.is_active === false) notFound();

  const config = {
    formType: form.form_type as InstantFormType,
    intro: (form.intro as InstantFormIntro) ?? {},
    questions: (form.questions as InstantFormQuestion[]) ?? [],
    consents: (form.consents as InstantFormConsent[]) ?? [],
    privacy: (form.privacy as InstantFormPrivacy) ?? {},
    completion: (form.completion as InstantFormCompletion) ?? {},
  };

  return (
    <PublicInstantForm
      clientId={form.client_id as string}
      clientName={client.name}
      clientLogo={client.logo_url ?? undefined}
      formSlug={form.slug as string}
      formName={form.name as string}
      config={config}
    />
  );
}
