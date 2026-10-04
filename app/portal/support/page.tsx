import { PortalFrame } from "@/components/portal/PortalFrame";
import { SupportForm, UpgradeForm } from "@/components/portal/PortalActions";
import { shortDate } from "@/components/portal/format";
import { requirePortal } from "@/lib/portal/page";
import { listPortalAssets, listPortalSupport } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalSupportPage() {
  const identity = await requirePortal();
  const [cases, assets] = await Promise.all([
    listPortalSupport(identity.clientId, identity.contactId),
    listPortalAssets(identity.clientId, identity.contactId, identity.settings),
  ]);
  return (
    <PortalFrame companyName={identity.companyName} logoUrl={identity.logoUrl} active="support">
      <h1 className="text-4xl font-semibold tracking-tight">Support</h1>
      <p className="mt-2 text-sm text-[#5c665f]">{identity.name}{identity.phone ? ` · ${identity.phone}` : ""}{identity.email ? ` · ${identity.email}` : ""}</p>
      {identity.settings.allowSupport ? (
        <section className="mt-6 rounded-3xl bg-white p-5">
          <SupportForm assets={assets.map((asset) => ({ id: asset.id as string, name: asset.name as string }))} />
          {identity.whatsappHref ? <a href={identity.whatsappHref} className="mt-3 inline-block text-sm font-medium text-[#0f6b4c]">Continue on WhatsApp</a> : null}
        </section>
      ) : <p className="mt-4 text-sm text-[#5c665f]">Support requests are handled directly by {identity.companyName}.</p>}
      <ul className="mt-6 space-y-3">
        {cases.map((item) => (
          <li key={item.id as string} className="rounded-3xl bg-white p-5">
            <p className="text-sm font-medium text-[#0f6b4c]">{item.status}</p>
            <p className="mt-2 text-sm">{item.message}</p>
            <p className="mt-2 text-xs text-[#5c665f]">{shortDate(item.createdAt as string)}</p>
          </li>
        ))}
      </ul>
      {identity.settings.allowUpgradeRequests ? (
        <section className="mt-6 rounded-3xl bg-white p-5">
          <h2 className="text-lg font-semibold">Request maintenance or an upgrade</h2>
          <p className="mt-1 text-sm text-[#5c665f]">Maintenance uses the form above. An upgrade starts a new conversation with the company.</p>
          <div className="mt-3"><UpgradeForm /></div>
        </section>
      ) : null}
    </PortalFrame>
  );
}
