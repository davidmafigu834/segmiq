import { PublicOfferView } from "@/components/platform-sales/PublicOfferView";
export const dynamic = "force-dynamic";
export default function OfferPage({ params }: { params: { token: string } }) {
  return <PublicOfferView token={params.token} />;
}
