/**
 * Featured landing-page customer story.
 * Only populate with approved, real customer content — never invent endorsements.
 */
export type FeaturedCustomerStory = {
  quote: string;
  name: string;
  role: string;
  company: string;
  /** Public path to company logo, if available */
  companyLogo?: string;
  /** Public path to approved customer / team photo */
  photo?: string;
  initials?: string;
  industry?: string;
  teamSize?: string;
  usingFor?: string;
  /** Only set if a real case-study route/page exists */
  caseStudyHref?: string;
};

/**
 * Set to a real approved story when assets and copy are ready.
 * Leave `null` to show the internal placeholder / hide fabricated proof.
 */
export const FEATURED_CUSTOMER_STORY: FeaturedCustomerStory | null = null;
