/**
 * Marketing “Trusted by” client logos.
 * Only include companies with real logo files under /public — never invent brands.
 */
export type TrustedClient = {
  name: string;
  /** Public path, e.g. /marketing/clients/acme.svg */
  logo: string;
  /** Intrinsic pixel size for Next/Image (layout stability). */
  width: number;
  height: number;
};

/**
 * Populate when real transparent SVG/PNG/WebP assets are added to:
 * public/marketing/clients/
 */
export const TRUSTED_CLIENTS: TrustedClient[] = [];
