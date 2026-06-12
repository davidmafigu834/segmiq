import HeroSlider from "@/components/marketing/HeroSlider";
import SegmiqLandingPage from "@/components/marketing/SegmiqLandingPage";
import JsonLd from "@/components/seo/JsonLd";
import { getHeroSlides } from "@/lib/hero";
import { organizationLd, pageMetadata, websiteLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Revenue operating system for service businesses",
  description:
    "Segmiq is a revenue operating system for construction, solar, roofing, electrical, and landscaping businesses across Africa — capture, score, and close every lead.",
  path: "/",
});

export default async function MarketingHomePage() {
  const slides = await getHeroSlides();

  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <HeroSlider slides={slides} />
      <SegmiqLandingPage />
    </>
  );
}
