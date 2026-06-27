import AnimatedHero from "@/components/marketing/AnimatedHero";
import SegmiqLandingPage from "@/components/marketing/SegmiqLandingPage";
import ServiceNowBackground from "@/components/marketing/ServiceNowBackground";
import JsonLd from "@/components/seo/JsonLd";
import { organizationLd, pageMetadata, websiteLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Revenue operating system for service businesses",
  description:
    "Segmiq is a revenue operating system for construction, solar, roofing, electrical, and landscaping businesses across Africa — capture, score, and close every lead.",
  path: "/",
});

export default function MarketingHomePage() {
  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      {/* One living background for the whole page — evolves as you scroll. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <ServiceNowBackground className="absolute inset-0 h-full w-full" scrollDriven />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/80" />
      </div>
      <AnimatedHero />
      <SegmiqLandingPage />
    </>
  );
}
