import { getPublicBaseUrl } from "@/lib/constants";

/** Public landing URL for a client slug. */
export function getPublicLandingPageUrl(slug: string): string {
  return `${getPublicBaseUrl()}/p/${slug}`;
}

/** Public Instant Form URL. */
export function getPublicInstantFormUrl(slug: string): string {
  return `${getPublicBaseUrl()}/f/${slug}`;
}
