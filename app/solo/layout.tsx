export const dynamic = "force-dynamic";

import { SalesThemeScope } from "@/components/layouts/SalesThemeScope";

export default function SoloRootLayout({ children }: { children: React.ReactNode }) {
  return <SalesThemeScope>{children}</SalesThemeScope>;
}
