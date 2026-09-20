import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { WhatsAppTemplateTester } from "@/components/agency/WhatsAppTemplateTester";
import { defaultSampleOgImageUrl, listTemplates } from "@/lib/messaging/meta-whatsapp-templates";

export const dynamic = "force-dynamic";

export default async function WhatsAppTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const result = await listTemplates();
  const sampleOgUrl = defaultSampleOgImageUrl();

  return (
    <AgencyLayout breadcrumb="Operations / WhatsApp" pageTitle="WhatsApp">
      <p className="mb-6 max-w-2xl text-[13px] text-[var(--text-secondary)]">
        Live templates from your Meta WABA. Send test messages to your own WhatsApp number.
      </p>
      <WhatsAppTemplateTester
        listError={result.ok ? null : result.error}
        templates={result.ok ? result.templates : []}
        sampleOgImageUrl={sampleOgUrl}
      />
    </AgencyLayout>
  );
}
