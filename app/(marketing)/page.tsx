import SegmiqLandingPage from "@/components/marketing/SegmiqLandingPage";
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
      <SegmiqLandingPage />
    </>
  );
}
