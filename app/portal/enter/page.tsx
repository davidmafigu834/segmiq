import { redirect } from "next/navigation";
import { EnterForm } from "@/components/portal/PortalActions";
import { getPortalIdentity } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalEnterPage({ searchParams }: { searchParams: { t?: string } }) {
  const identity = await getPortalIdentity();
  if (identity) redirect("/portal");
  return (
    <div className="min-h-screen bg-[#f4f1ea] px-5 py-16 text-[#1a1f1c]">
      <div className="mx-auto max-w-lg">
        <p className="text-sm font-medium text-[#0f6b4c]">Customer portal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">View your project</h1>
        <p className="mt-3 text-base leading-7 text-[#5c665f]">
          Enter the code sent to your phone. A link on its own does not sign you in.
        </p>
        <div className="mt-8">
          <EnterForm token={searchParams.t || null} />
        </div>
        <p className="mt-10 text-[11px] tracking-wide text-[#8a918c]">Powered by SegmiQ</p>
      </div>
    </div>
  );
}
