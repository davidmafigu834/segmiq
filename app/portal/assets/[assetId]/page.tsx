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
      <Link href="/portal/assets" className="inline-flex min-h-11 items-center text-[14px] text-sales-text-secondary">My system</Link>
      <h1 className="mt-2 text-[2rem] font-semibold leading-tight">{asset.name}</h1>
      <dl className="mt-6 space-y-3 text-[15px]">
        {asset.manufacturer ? <div><dt className="text-sales-text-secondary">Manufacturer</dt><dd className="font-medium">{asset.manufacturer}</dd></div> : null}
        {asset.model ? <div><dt className="text-sales-text-secondary">Model</dt><dd className="font-medium">{asset.model}</dd></div> : null}
        {asset.serialNumber ? <div><dt className="text-sales-text-secondary">Serial number</dt><dd className="font-medium">{asset.serialNumber}</dd></div> : null}
        {asset.installedAt ? <div><dt className="text-sales-text-secondary">Installed</dt><dd className="font-medium">{shortDate(asset.installedAt as string)}</dd></div> : null}
        <div><dt className="text-sales-text-secondary">Status</dt><dd className="font-medium">{asset.status}</dd></div>
      </dl>
      {asset.warranties.length ? (
        <section className="mt-8 divide-y divide-sales-border">
          {asset.warranties.map((warranty, index) => (
            <article key={index} className="py-4">
              <p className="text-[1.15rem] font-semibold">{String(warranty.type || "Warranty").replaceAll("_", " ")}</p>
              <p className="mt-1 text-[15px]">{warranty.label}</p>
              <p className="mt-2 text-[14px] text-sales-text-secondary">Started {shortDate(warranty.startsAt)}</p>
              <p className="text-[14px] text-sales-text-secondary">{warranty.expiresAt ? `Active until ${shortDate(warranty.expiresAt)}` : "Warranty terms recorded"}</p>
              {warranty.summary ? <p className="mt-2 text-[15px]">{warranty.summary}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
      {identity.settings.allowSupport ? (
        <section className="mt-8 border-t border-sales-border pt-6">
          <h2 className="text-[1.15rem] font-semibold">Report a problem</h2>
          <div className="mt-3"><SupportForm assets={[{ id: asset.id as string, name: asset.name as string }]} /></div>
        </section>
      ) : null}
    </PortalFrame>
  );
}
