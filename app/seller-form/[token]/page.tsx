import type { Metadata } from "next";
import { SellerForm } from "@/components/real-estate/seller-intake/SellerForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seller form",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SellerFormPage({ params }: { params: { token: string } }) {
  return <SellerForm token={params.token} />;
}
