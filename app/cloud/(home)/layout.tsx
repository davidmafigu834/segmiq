/**
 * Layout for the Segmiq Cloud marketing landing (cloud.segmiq.com root).
 * Applies the Cloud theme (warm cream + brown) and wraps the landing with the Cloud
 * header/footer. Scoped to this route group only, so the Cloud product routes
 * (login, signup, dashboard, share) keep the product layout untouched.
 *
 * Routing: the project-root middleware.ts rewrites cloud.segmiq.com -> /cloud,
 * so this segment serves the subdomain landing.
 */

import type { ReactNode } from "react";
import CloudHeader from "@/components/cloud/CloudHeader";
import CloudFooter from "@/components/cloud/CloudFooter";

export default function CloudLandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#F7F4EF] text-[#1C1410] antialiased font-sans min-h-screen">
      <CloudHeader />
      <main>{children}</main>
      <CloudFooter />
    </div>
  );
}
