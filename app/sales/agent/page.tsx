import { Suspense } from "react";
import { SalesCommandWorkspace } from "@/components/sales/command/SalesCommandWorkspace";
import { Head, SolarPageBones } from "@/components/sales/solar/desk";
import { SolarSalesFrame } from "@/components/sales/solar/SolarSalesFrame";
import { loadSolarSalesPage } from "@/lib/sales/solar-workflow/salesperson-page";

export const dynamic = "force-dynamic";

export default async function SalesAgentPage() {
  const { shell } = await loadSolarSalesPage();
  return (
    <SolarSalesFrame shell={shell} title="SegmiQ Agent" breadcrumb="Sales / SegmiQ Agent">
      <div className="space-y-8">
        <Head
          kicker="Intelligence"
          title="SegmiQ Agent"
          detail="Ask for the next lead, a follow-up, or a quotation. The stage still comes from the visit, the quotation, and the deal."
        />
        <Suspense fallback={<SolarPageBones label="Loading SegmiQ Agent" />}>
          <SalesCommandWorkspace />
        </Suspense>
      </div>
    </SolarSalesFrame>
  );
}
