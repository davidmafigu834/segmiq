import { redirect } from "next/navigation";

export default function ClientAccountRedirectPage() {
  redirect("/client/settings/profile");
}
