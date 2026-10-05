import Link from "next/link";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { shortDate } from "@/components/portal/format";
import { requirePortal } from "@/lib/portal/page";
import { listPortalAssets } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalAssetsPage() {
  const identity = await requirePortal();
  const assets = await listPortalAssets(identity.clientId, identity.contactId, identity.settings);
  const groups = new Map<string, typeof assets>();
  for (const asset of assets) {
    const site = asset.site || "Site";
    groups.set(site, [...(groups.get(site) ?? []), asset]);
  }
  return (
    <PortalFrame companyName={identity.companyName} logoUrl={identity.logoUrl} active="assets">
      <h1 className="text-[2rem] font-semibold leading-tight">My system</h1>
      {!identity.settings.showAssets ? <p className="mt-4 text-[16px] text-sales-text-secondary">Installed equipment is not shown on this portal.</p> : null}
      {identity.settings.showAssets && assets.length === 0 ? (
        <p className="mt-6 text-[16px] text-sales-text-secondary">Installed equipment will appear after commissioning.</p>
      ) : null}
      {[...groups.entries()].map(([site, rows]) => (
        <section key={site} className="mt-8">
          <h2 className="text-[14px] text-sales-text-secondary">{site}</h2>
          <ul className="mt-2 divide-y divide-sales-border">
            {rows.map((asset) => (
              <li key={asset.id as string}>
                <Link href={`/portal/assets/${asset.id}`} className="block py-4">
                  <p className="text-[1.15rem] font-semibold">{asset.name}</p>
                  <p className="mt-1 text-[15px] text-sales-text-secondary">{asset.status}{asset.installedAt ? ` · ${shortDate(asset.installedAt as string)}` : ""}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PortalFrame>
  );
}
