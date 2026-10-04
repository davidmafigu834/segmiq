import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { SupportForm } from "@/components/portal/PortalActions";
import { shortDate } from "@/components/portal/format";
import { requirePortal } from "@/lib/portal/page";
import { getPortalAsset } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalAssetPage({ params }: { params: { assetId: string } }) {
  const identity = await requirePortal();
  const asset = await getPortalAsset(identity.clientId, identity.contactId, params.assetId, identity.settings);
  if (!asset) notFound();
  return (
    <PortalFrame companyName={identity.companyName} logoUrl={identity.logoUrl} active="assets">
      <Link href="/portal/assets" className="text-sm text-[#5c665f]">My system</Link>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{asset.name}</h1>
      <dl className="mt-6 space-y-3 text-sm">
        {asset.manufacturer ? <div><dt className="text-[#5c665f]">Manufacturer</dt><dd className="font-medium">{asset.manufacturer}</dd></div> : null}
        {asset.model ? <div><dt className="text-[#5c665f]">Model</dt><dd className="font-medium">{asset.model}</dd></div> : null}
        {asset.serialNumber ? <div><dt className="text-[#5c665f]">Serial number</dt><dd className="font-medium">{asset.serialNumber}</dd></div> : null}
        {asset.installedAt ? <div><dt className="text-[#5c665f]">Installed</dt><dd className="font-medium">{shortDate(asset.installedAt as string)}</dd></div> : null}
        <div><dt className="text-[#5c665f]">Status</dt><dd className="font-medium">{asset.status}</dd></div>
      </dl>
      {asset.warranties.length ? (
        <section className="mt-8 space-y-3">
          {asset.warranties.map((warranty, index) => (
            <article key={index} className="rounded-3xl bg-white p-5">
              <p className="text-lg font-semibold">{String(warranty.type || "Warranty").replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm text-[#0f6b4c]">{warranty.label}</p>
              <p className="mt-2 text-sm text-[#5c665f]">Started {shortDate(warranty.startsAt)}</p>
              <p className="text-sm text-[#5c665f]">{warranty.expiresAt ? `Expires ${shortDate(warranty.expiresAt)}` : "Warranty terms available"}</p>
              {warranty.summary ? <p className="mt-2 text-sm">{warranty.summary}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
      {identity.settings.allowSupport ? (
        <section className="mt-6 rounded-3xl bg-white p-5">
          <h2 className="text-lg font-semibold">Report a problem</h2>
          <div className="mt-3"><SupportForm assets={[{ id: asset.id as string, name: asset.name as string }]} /></div>
        </section>
      ) : null}
    </PortalFrame>
  );
}
