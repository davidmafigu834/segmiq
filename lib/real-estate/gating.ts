import { redirect } from "next/navigation";
import { isRealEstate } from "@/lib/terminology";

/** True when a trades (or unknown) company must not stay on a real-estate-only route. */
export function shouldRedirectFromRealEstateRoute(businessType: unknown): boolean {
  return !isRealEstate(businessType);
}

/** Send trades (and unknown) companies away from real-estate-only routes. */
export function redirectIfNotRealEstate(businessType: unknown): void {
  if (shouldRedirectFromRealEstateRoute(businessType)) {
    redirect("/client/dashboard");
  }
}
