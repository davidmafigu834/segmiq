import { redirect } from "next/navigation";
import { EnterForm } from "@/components/portal/PortalActions";
import { getPortalIdentity } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalEnterPage({ searchParams }: { searchParams: { t?: string } }) {
  const identity = await getPortalIdentity();
  if (identity) redirect("/portal");
  return (
    <div className="min-h-screen bg-sales-surface px-5 py-16 text-sales-text-primary">
      <div className="mx-auto max-w-lg">
        <p className="text-[14px] font-medium text-sales-text-secondary">Customer portal</p>
        <h1 className="mt-3 text-[2rem] font-semibold leading-tight">View your project</h1>
        <p className="mt-3 text-[16px] leading-7 text-sales-text-secondary">
          Enter the code sent to your phone. A link on its own does not sign you in.
        </p>
        <div className="mt-8">
          <EnterForm token={searchParams.t || null} />
        </div>
      </div>
    </div>
  );
}
