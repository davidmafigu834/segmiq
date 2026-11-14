import type { Metadata } from "next";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicBaseUrl } from "@/lib/constants";
import { loadPublicListingPage } from "@/lib/real-estate/agent-listing-pages/service";
import { absoluteAsset, liveFunnelMeta } from "@/lib/real-estate/funnels/service";
import { PublicListingPage, type PublicListingModel } from "@/components/real-estate/public-listing/PublicListingPage";
import { FunnelFrame } from "@/components/real-estate/funnels/FunnelFrame";
import styles from "@/components/real-estate/public-listing/property-page.module.css";

function requestContext(recordView: boolean) {
  const headerStore = headers();
  return {
    userAgent: headerStore.get("user-agent"),
    referrer: headerStore.get("referer"),
    visitor: headerStore.get("x-sq-visitor"),
    recordView,
  };
}

type Page = PublicListingModel & {
  canonicalPath: string;
  agency: { name: string };
  agent: { name: string } | null;
};

export async function propertyMetadata(slug: string, token: string | null): Promise<Metadata> {
  const db = createAdminClient();
  const loaded = await loadPublicListingPage(db, slug, token, requestContext(false));
  if (loaded.state !== "ready") {
    return { title: "Property unavailable", robots: { index: false, follow: false } };
  }
  const page = loaded.page as Page;
  const funnel = await liveFunnelMeta(db, slug);
  const canonical = `${getPublicBaseUrl()}${page.canonicalPath}`;
  const title = funnel?.shareTitle || `${page.property.heading} · ${page.agency.name}`;
  const description =
    funnel?.shareSummary || page.property.description?.slice(0, 180) || `${page.property.statusLabel} property from ${page.agency.name}.`;
  const image = absoluteAsset(funnel?.shareImageUrl ?? null) ?? `${getPublicBaseUrl()}/property/${slug}/opengraph-image`;
  const shared = token && page.agent ? `${page.agent.name}, ${page.agency.name}` : page.agency.name;
  return {
    title,
    description,
    alternates: { canonical },
    robots: loaded.indexable && !token ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, url: canonical, type: "website", siteName: shared, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export function PropertyUnavailable() {
  return (
    <main className={`${styles.page} sales-dashboard-premium`} data-re-form="dark">
      <section className={styles.unavailable}>
        <h1>This property link is unavailable</h1>
        <p className={styles.prose}>The listing is not being marketed on this link. No private property details are shown.</p>
      </section>
    </main>
  );
}

export async function PropertyRoute({ slug, token }: { slug: string; token: string | null }) {
  const db = createAdminClient();
  const loaded = await loadPublicListingPage(db, slug, token, requestContext(true));
  if (loaded.state !== "ready") return <PropertyUnavailable />;
  const funnel = await liveFunnelMeta(db, slug);
  if (funnel) {
    const params = new URLSearchParams({ slug, v: String(funnel.htmlVersion) });
    if (token) params.set("ref", token);
    const page = loaded.page as Page;
    return (
      <main style={{ position: "fixed", inset: 0, background: "#fff" }}>
        <FunnelFrame slug={slug} token={token} title={funnel.shareTitle || page.property.heading} src={`/api/public/funnels/document?${params.toString()}`} />
      </main>
    );
  }
  return (
    <main>
      <PublicListingPage model={loaded.page as PublicListingModel} />
    </main>
  );
}
