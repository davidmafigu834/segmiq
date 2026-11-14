import type { Metadata } from "next";
import { PropertyRoute, propertyMetadata } from "@/components/real-estate/funnels/property-route";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams: { ref?: string } }): Promise<Metadata> {
  return propertyMetadata(params.slug, searchParams.ref ?? null);
}

export default async function PropertyMarketingPage({ params, searchParams }: { params: { slug: string }; searchParams: { ref?: string } }) {
  return <PropertyRoute slug={params.slug} token={searchParams.ref ?? null} />;
}
