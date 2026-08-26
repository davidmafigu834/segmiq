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

export const FEATURED_CUSTOMER_STORY: FeaturedCustomerStory = {
  quote:
    "SegmiQ gave us visibility over every enquiry, follow-up and quotation. Our sales team now knows exactly what needs attention, and management can see where every deal stands without chasing people for updates.",
  name: "Tendai Muchengeti",
  role: "Sales Manager",
  company: "Apex Equipment Solutions",
  photo: "/segmiq/visuals/customer-tendai-muchengeti.webp",
  initials: "TM",
};
