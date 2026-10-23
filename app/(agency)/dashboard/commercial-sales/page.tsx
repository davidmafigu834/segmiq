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
  return (
    <AgencyLayout
      breadcrumb="PLATFORM / COMMERCIAL SALES"
      pageTitle="Commercial Sales"
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
    </AgencyLayout>
  );
}
