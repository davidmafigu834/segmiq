import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { PricingCatalogue } from "@/components/commercial/PricingCatalogue";
import { loadCanonicalCatalogue } from "@/lib/commercial/catalogue-repository";
import { createPricingPresentation } from "@/lib/commercial/presentation";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const presentation = createPricingPresentation(await loadCanonicalCatalogue({ forNewOffer: true }));
  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL" pageTitle="Pricing & Plans">
      <div className="space-y-6">
        <div className="max-w-2xl">
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Inspect the active official catalogue, entitlements, AI quotas, and effective version. Catalogue amendments require a new version; they never rewrite invoices, quotations, subscriptions, or signed agreements.
          </p>
        </div>
        <PricingCatalogue presentation={presentation} admin />
      </div>
    </AgencyLayout>
  );
}
