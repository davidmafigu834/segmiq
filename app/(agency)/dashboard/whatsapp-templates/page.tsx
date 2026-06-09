import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { WhatsAppTemplateTester } from "@/components/agency/WhatsAppTemplateTester";
import { defaultSampleOgImageUrl, listTemplates } from "@/lib/messaging/meta-whatsapp-templates";

export const dynamic = "force-dynamic";

export default async function WhatsAppTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    redirect("/login");
  }

  const result = await listTemplates();
  const sampleOgUrl = defaultSampleOgImageUrl();

  return (
    <AgencyLayout breadcrumb="AGENCY / WHATSAPP TEMPLATES" pageTitle="WhatsApp templates">
      <div className="ag-fade-in mb-8">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
          AGENCY / WHATSAPP TEMPLATES
        </p>
        <h1 className="mt-1 font-display text-[28px] leading-none tracking-display text-[var(--text-primary)] md:text-[40px]">
          Template tester
        </h1>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
          Live templates from your Meta WABA. Send test messages to your own WhatsApp number.
        </p>
      </div>
      <WhatsAppTemplateTester
        listError={result.ok ? null : result.error}
        templates={result.ok ? result.templates : []}
        sampleOgImageUrl={sampleOgUrl}
      />
    </AgencyLayout>
  );
}
