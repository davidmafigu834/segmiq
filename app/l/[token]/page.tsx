import { redirect } from "next/navigation";

/** Short magic-link path used in Meta URL buttons (`/l/{{token}}`). */
export default function ShortMagicLinkPage({ params }: { params: { token: string } }) {
  redirect(`/lead/${params.token}`);
}
