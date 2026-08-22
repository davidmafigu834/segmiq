import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Canonical customer page is /quote/:token. /q/:token is the short public alias. */
export default function ShortPublicQuotePage({ params }: { params: { token: string } }) {
  redirect(`/quote/${params.token}`);
}
