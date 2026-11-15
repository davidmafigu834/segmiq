import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
import {
  listPlatformProspects,
  listPlatformQuotes,
} from "@/lib/platform-sales/repository";
import { CommercialSalesClient } from "@/components/platform-sales/CommercialSalesClient";
import { RecordFrame } from "@/components/platform/workbench";
export const dynamic = "force-dynamic";
export default async function CommercialSalesPage({ searchParams }: { searchParams?: { view?: string; create?: string } }) {
  const session = await getServerSession(authOptions);
  if (
    !session?.userId ||
    session.role !== "SUPER_ADMIN" ||
    session.isImpersonating
  )
    redirect("/login");
  const enabled = platformSalesEnabled("quotes");
  const [prospects, quotes] = enabled
    ? await Promise.all([listPlatformProspects(), listPlatformQuotes()])
    : [[], []];
  const quotesView = searchParams?.view === "quotes";
  return (
    <AgencyLayout
      breadcrumb="PLATFORM / COMMERCIAL SALES"
      pageTitle={quotesView ? "Quotations" : "Prospects"}
    >
      <RecordFrame
        detail={quotesView ? "A quotation is the offer. It does not activate the organisation." : "A prospect is a company that is not an organisation yet."}
        fact={quotesView ? {
          name: quotes.length ? `${quotes.length} quotations are on the register.` : "No quotation is open.",
          detail: "Open the one that has not been accepted.",
          action: "Open agreements",
          href: "/dashboard/commercial-sales/agreements",
        } : {
          name: prospects.length ? `${prospects.length} prospects are waiting.` : "No prospect is waiting.",
          detail: "Create the organisation only after the quotation is accepted.",
          action: "Open quotations",
          href: "/dashboard/commercial-sales?view=quotes",
        }}
      >
      {enabled ? (
        <CommercialSalesClient
          initialProspects={prospects as never[]}
          initialQuotes={quotes as never[]}
          initialView={searchParams?.view === "quotes" ? "quotes" : searchParams?.view === "builder" ? "builder" : "prospects"}
          initialCreate={searchParams?.create === "1"}
        />
      ) : (
        <div className="max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
          <h2 className="font-semibold text-[var(--text-primary)]">
            Internal rollout is disabled
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Apply and verify the additive platform-sales migration, configure
            private PDF storage, then deliberately enable the quotation flag for
            synthetic Super Admin testing. No customer tenant is provisioned
            from this screen.
          </p>
        </div>
      )}
      </RecordFrame>
    </AgencyLayout>
  );
}
