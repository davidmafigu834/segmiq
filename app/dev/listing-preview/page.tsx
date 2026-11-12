import { notFound } from "next/navigation";
import { PublicListingPage, type PublicListingModel } from "@/components/real-estate/public-listing/PublicListingPage";
import styles from "@/components/real-estate/public-listing/property-page.module.css";

const photo = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#d7cfc3"/><rect x="180" y="280" width="840" height="360" fill="#efeae3"/><path d="M180 420 L600 180 L1020 420" fill="none" stroke="#2f3a32" stroke-width="14"/><rect x="470" y="460" width="160" height="180" fill="#c8bfb2"/></svg>`
);

function model(withPhotos: boolean): PublicListingModel {
  return {
    slug: "kensington-preview",
    property: {
      heading: "Flat 4B, Kensington Court",
      suburb: "Belvedere",
      address: "Flat 4B, Kensington Court",
      priceLabel: withPhotos ? "USD 98,000" : null,
      priceOnRequest: !withPhotos,
      currencyContext: withPhotos ? "quotation_currency" : "unconfigured",
      transactionLabel: "For sale",
      categoryLabel: "Apartment",
      bedrooms: 2,
      bathrooms: 1,
      sizeSqm: 95,
      description: "A sectional-title apartment with a practical layout for everyday living.",
      statusLabel: "Available",
      advertiseAsAvailable: true,
      photoCount: withPhotos ? 2 : 0,
    },
    agency: {
      name: "Haven Properties",
      logoUrl: null,
      websiteUrl: "https://haven.example",
      catalogueUrl: "https://haven.example/properties",
      accent: null,
    },
    agent: { name: "Farai Mutasa", role: "Agent", initials: "FM", photoUrl: null },
    actions: { enquire: true, viewing: true, whatsapp: "https://wa.me/263770000000?text=Hello" },
    photos: withPhotos ? [{ index: 0, src: photo }, { index: 1, src: photo }] : [],
    related: [
      { heading: "12 Stonechat Lane", suburb: "Borrowdale", bedrooms: 4, bathrooms: 3, priceLabel: withPhotos ? "USD 250,000" : null, photoSrc: withPhotos ? photo : null, href: null },
      { heading: "8 Jacaranda Close", suburb: "Avondale", bedrooms: 3, bathrooms: 2, priceLabel: withPhotos ? "USD 180,000" : null, photoSrc: null, href: null },
    ],
  };
}

export default function ListingPreviewPage({ searchParams }: { searchParams: { case?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  if (searchParams.case === "unavailable") {
    return (
      <main className={`${styles.page} sales-dashboard-premium`} data-re-form="dark">
        <section className={styles.unavailable}>
          <p className={styles.kicker}>Haven Properties</p>
          <h1>This property link is unavailable</h1>
          <p className={styles.prose}>The listing is not being marketed on this link. No private property details are shown.</p>
        </section>
      </main>
    );
  }
  return (
    <main>
      <PublicListingPage model={model(searchParams.case !== "empty")} />
    </main>
  );
}
