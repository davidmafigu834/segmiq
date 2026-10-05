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
      <h1 className="text-[2rem] font-semibold leading-tight">Support</h1>
      <p className="mt-2 text-[15px] text-sales-text-secondary">{identity.name}{identity.phone ? ` · ${identity.phone}` : ""}{identity.email ? ` · ${identity.email}` : ""}</p>
      {identity.settings.allowSupport ? (
        <section className="mt-6">
          <SupportForm assets={assets.map((asset) => ({ id: asset.id as string, name: asset.name as string }))} />
          {identity.whatsappHref ? <a href={identity.whatsappHref} className="mt-4 inline-flex min-h-11 items-center text-[15px] font-semibold">Continue on WhatsApp</a> : null}
        </section>
      ) : <p className="mt-4 text-[16px] text-sales-text-secondary">Support requests are handled directly by {identity.companyName}.</p>}
      {cases.length ? (
        <ul className="mt-8 divide-y divide-sales-border">
          {cases.map((item) => (
            <li key={item.id as string} className="py-4">
              <p className="text-[14px] font-medium">{String(item.status).replaceAll("_", " ")}</p>
              <p className="mt-2 text-[15px]">{item.message}</p>
              <p className="mt-2 text-[13px] text-sales-text-secondary">{shortDate(item.createdAt as string)}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {identity.settings.allowUpgradeRequests ? (
        <section className="mt-8 border-t border-sales-border pt-6">
          <h2 className="text-[1.25rem] font-semibold">Need more capacity?</h2>
          <p className="mt-1 text-[15px] text-sales-text-secondary">Request an upgrade. Your installed system stays as it is until the company agrees the work.</p>
          <div className="mt-3"><UpgradeForm /></div>
        </section>
      ) : null}
    </PortalFrame>
  );
}
