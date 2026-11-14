import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Marketing links now live in Funnels. Per-link analytics pages under this path still work. */
export default function SharedListingsPage() {
  redirect("/sales/funnels");
}
