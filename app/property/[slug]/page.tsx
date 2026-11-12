import type { Metadata } from "next";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicBaseUrl } from "@/lib/constants";
import { loadPublicListingPage } from "@/lib/real-estate/agent-listing-pages/service";
import { PublicListingPage, type PublicListingModel } from "@/components/real-estate/public-listing/PublicListingPage";
import styles from "@/components/real-estate/public-listing/property-page.module.css";

export const dynamic = "force-dynamic";

function requestContext(recordView: boolean) {
  const headerStore = headers();
  return {
    userAgent: headerStore.get("user-agent"),
    referrer: headerStore.get("referer"),
    visitor: headerStore.get("x-sq-visitor"),
    recordView,
  };
}

export async function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams: { ref?: string } }): Promise<Metadata> {
  const loaded = await loadPublicListingPage(createAdminClient(), params.slug, searchParams.ref ?? null, requestContext(false));
  if (loaded.state !== "ready") {
    return { title: "Property unavailable", robots: { index: false, follow: false } };
  }
  const page = loaded.page as PublicListingModel & { canonicalPath: string; agency: { name: string } };
  const title = `${page.property.heading} · ${page.agency.name}`;
  const description = page.property.description?.slice(0, 180) || `${page.property.statusLabel} property from ${page.agency.name}.`;
  const canonical = `${getPublicBaseUrl()}${page.canonicalPath}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: loaded.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, url: canonical, type: "website", images: [`${getPublicBaseUrl()}/property/${params.slug}/opengraph-image`] },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PropertyMarketingPage({ params, searchParams }: { params: { slug: string }; searchParams: { ref?: string } }) {
  const loaded = await loadPublicListingPage(createAdminClient(), params.slug, searchParams.ref ?? null, requestContext(true));
  if (loaded.state !== "ready") {
    return (
      <main className={`${styles.page} sales-dashboard-premium`} data-re-form="dark">
        <section className={styles.unavailable}>
          <h1>This property link is unavailable</h1>
          <p className={styles.prose}>The listing is not being marketed on this link. No private property details are shown.</p>
        </section>
      </main>
    );
  }
  return (
    <main>
      <PublicListingPage model={loaded.page as PublicListingModel} />
    </main>
  );
}
