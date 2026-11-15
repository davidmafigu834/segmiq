import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { RecordFrame } from "@/components/platform/workbench";
import { PricingCatalogue } from "@/components/commercial/PricingCatalogue";
import { loadCanonicalCatalogue } from "@/lib/commercial/catalogue-repository";
import { createPricingPresentation } from "@/lib/commercial/presentation";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const presentation = createPricingPresentation(await loadCanonicalCatalogue({ forNewOffer: true }));
  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL" pageTitle="Pricing & Plans">
      <RecordFrame
        detail="The catalogue is the source of prices. A change is a new version. It does not rewrite an invoice, a quotation, a subscription, or a signed agreement."
        fact={{
          name: "Read the active version before you quote.",
          detail: "Amounts on this page come from the catalogue. Nothing here is a new price.",
          action: "Open commercial",
          href: "/dashboard/commercial",
        }}
      >
        <PricingCatalogue presentation={presentation} admin />
      </RecordFrame>
    </AgencyLayout>
  );
}
