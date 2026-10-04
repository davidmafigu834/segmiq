import { redirect } from "next/navigation";
import { getPortalIdentity } from "@/lib/portal/service";

export async function requirePortal() {
  const identity = await getPortalIdentity();
  if (!identity) redirect("/portal/enter");
  return identity;
}
