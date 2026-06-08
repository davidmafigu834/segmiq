/**
 * Renders a JSON-LD structured-data block. Pass any of the builder objects from lib/seo.
 * Server component — safe to drop into any page.
 *
 * Usage:
 *   import JsonLd from "@/components/seo/JsonLd";
 *   import { organizationLd, websiteLd } from "@/lib/seo";
 *   <JsonLd data={[organizationLd(), websiteLd()]} />
 */

export default function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Structured data is trusted, app-authored content.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
