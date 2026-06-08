import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Segmiq",
  description: "How Segmiq collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
