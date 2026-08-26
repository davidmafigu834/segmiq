import LandingPage from "@/components/marketing/landing/LandingPage";
import JsonLd from "@/components/seo/JsonLd";
import { organizationLd, pageMetadata, websiteLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Introducing SegmiQ Agentic AI",
  description:
    "SegmiQ Agentic AI answers WhatsApp enquiries, qualifies leads, prepares quotes and follows up inside the revenue OS for service businesses in Africa — then brings a human in when judgement is required.",
  path: "/",
});

export default function MarketingHomePage() {
  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <LandingPage />
    </>
  );
}
