import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { FunnelSetup } from "@/components/real-estate/funnels/agent/FunnelSetup";
import { getPublicBaseUrl } from "@/lib/constants";
import { funnelsPageContext } from "@/lib/real-estate/funnels/page-guard";
import { getAgentProfile } from "@/lib/real-estate/funnels/service";
import { suggestedHandle } from "@/lib/real-estate/funnels/policy";

export const dynamic = "force-dynamic";

export default async function FunnelSetupPage() {
  const { db, actor, shell, me } = await funnelsPageContext();
  const [profile, { data: client }, { data: user }, { data: live }] = await Promise.all([
    getAgentProfile(db, actor.userId),
    db.from("clients").select("name").eq("id", actor.clientId!).maybeSingle(),
    db.from("users").select("phone").eq("id", actor.userId).maybeSingle(),
    db.from("re_listing_funnels").select("listings!inner(public_slug)").eq("client_id", actor.clientId!).eq("status", "live").limit(1),
  ]);
  const firstLive = ((live ?? []) as Array<{ listings: { public_slug?: string | null } | Array<{ public_slug?: string | null }> }>)[0];
  const listing = Array.isArray(firstLive?.listings) ? firstLive?.listings[0] : firstLive?.listings;
  const initial = profile
    ? { handle: profile.handle, whatsapp: profile.whatsappDisplay, line: profile.line ?? "" }
    : {
        handle: suggestedHandle(me.name),
        whatsapp: (user as { phone?: string | null } | null)?.phone ?? "",
        line: `Hi, I'm ${me.first}. I'll personally walk you through this property.`,
      };
  return (
    <SalesLayout breadcrumb="Sales / FUNNELS" pageTitle="Your funnel link" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} breadcrumb="Sales / Funnels / Link" title="Your funnel link" description="How buyers see you on every funnel.">
        <FunnelSetup
          baseUrl={getPublicBaseUrl()}
          me={me}
          agencyName={(client as { name?: string } | null)?.name ?? "your agency"}
          exampleSlug={listing?.public_slug ?? null}
          initial={initial}
          firstTime={!profile}
        />
      </SalesAppShell>
    </SalesLayout>
  );
}
