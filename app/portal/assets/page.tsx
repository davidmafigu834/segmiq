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
      <h1 className="text-4xl font-semibold tracking-tight">My system</h1>
      {!identity.settings.showAssets ? <p className="mt-4 text-sm text-[#5c665f]">Installed equipment is not shown on this portal.</p> : null}
      {[...groups.entries()].map(([site, rows]) => (
        <section key={site} className="mt-8">
          <h2 className="text-sm font-medium text-[#5c665f]">{site}</h2>
          <div className="mt-3 space-y-3">
            {rows.map((asset) => (
              <Link key={asset.id as string} href={`/portal/assets/${asset.id}`} className="block rounded-3xl bg-white p-5">
                <p className="text-lg font-semibold">{asset.name}</p>
                <p className="mt-1 text-sm text-[#5c665f]">{asset.status}{asset.installedAt ? ` · ${shortDate(asset.installedAt as string)}` : ""}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </PortalFrame>
  );
}
