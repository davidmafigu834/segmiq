import LegalPage from "@/components/marketing/LegalPage";
import JsonLd from "@/components/seo/JsonLd";
import { TERMS } from "@/lib/legal";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description: "Terms governing your use of Segmiq CRM and Segmiq Cloud.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Terms of Service", path: "/terms" }])} />
      <LegalPage doc={TERMS} />
    </>
  );
}
