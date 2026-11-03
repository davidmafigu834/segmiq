import type { Metadata } from "next";
import { PublicSubmissionPortal } from "@/components/real-estate/compliance/PublicSubmissionPortal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secure document request",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function VerifyCompliancePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { sample?: string };
}) {
  const sample = process.env.NODE_ENV !== "production" && searchParams?.sample === "company"
    ? "company"
    : process.env.NODE_ENV !== "production" && searchParams?.sample === "individual"
      ? "individual"
      : null;
  return <PublicSubmissionPortal token={params.token} sample={sample} />;
}
