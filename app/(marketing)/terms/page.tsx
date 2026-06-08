import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Segmiq",
  description: "Terms governing your use of Segmiq CRM and Segmiq Cloud.",
};

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
