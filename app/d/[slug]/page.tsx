import { redirect } from "next/navigation";

/** Short dashboard link for Meta WhatsApp buttons (`https://segmiq.com/d/{{slug}}`). */
export default function DashboardShortLinkPage() {
  redirect("/client/dashboard");
}
