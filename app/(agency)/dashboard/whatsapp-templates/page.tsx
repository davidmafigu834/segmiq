import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { WhatsAppTemplateTester } from "@/components/agency/WhatsAppTemplateTester";
import { RecordFrame } from "@/components/platform/workbench";
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
      <RecordFrame
        detail="These are the live templates. A test goes only to your own WhatsApp number."
        fact={{
          name: result.ok ? (result.templates.length ? `${result.templates.length} templates are live.` : "No template is live.") : "The template list did not load.",
          detail: result.ok ? "Confirm the template before you send a test." : result.error,
          action: "Open jobs",
          href: "/dashboard/follow-up-reminders",
        }}
      >
      <WhatsAppTemplateTester
        listError={result.ok ? null : result.error}
        templates={result.ok ? result.templates : []}
        sampleOgImageUrl={sampleOgUrl}
      />
      </RecordFrame>
    </AgencyLayout>
  );
}
