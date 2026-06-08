import LegalPage from "@/components/marketing/LegalPage";
import JsonLd from "@/components/seo/JsonLd";
import { PRIVACY } from "@/lib/legal";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Segmiq collects, uses, and protects your data.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Privacy Policy", path: "/privacy" }])} />
      <LegalPage doc={PRIVACY} />
    </>
  );
}
