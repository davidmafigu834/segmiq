import { redirect } from "next/navigation";

/** Legacy Tasks route — sidebar and deep links now use `/sales/tasks`. */
export default function SalesFollowupsRedirectPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") params.set(key, value);
      else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
    }
  }
  const qs = params.toString();
  redirect(qs ? `/sales/tasks?${qs}` : "/sales/tasks");
}
