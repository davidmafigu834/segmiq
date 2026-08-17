import type { ManagerNotificationPrefs } from "@/lib/notification-prefs";

export type CompanySettingsQuote = {
  company_address: string | null;
  company_email: string | null;
  company_website: string | null;
  company_phone: string | null;
  footer_note: string | null;
  default_terms: string | null;
  quote_prefix: string | null;
  default_tax_rate: number;
};

export type CompanyAccountSummary = {
  planLabel: string;
  status: string;
  billingCycle: string;
  nextBillingDate: string | null;
  teamUsed: number;
  teamLimit: number | null;
  amount: number;
  currency: string;
};

export type CompanySettingsProfile = {
  id: string;
  name: string;
  industry: string | null;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  responseTimeLimitHours: number;
  dialCode: string | null;
  website: string | null;
  country: string | null;
  ownerEmail: string | null;
  assignmentMode: string;
  businessType: string;
  capabilityTagline: string | null;
  yearsInOperation: number | null;
  facebookPageName: string | null;
  facebookConnected: boolean;
  agencyManaged: boolean;
};

export type CompanySettingsCurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  notificationPrefs: ManagerNotificationPrefs;
};

export type CompanyOperatingHours = {
  workingDays: number[];
  workStartTime: string;
  workEndTime: string;
};

export type CompanySettingsPageData = {
  clientId: string;
  profile: CompanySettingsProfile;
  quote: CompanySettingsQuote;
  timezone: string;
  operatingHours: CompanyOperatingHours;
  account: CompanyAccountSummary | null;
  agencyContact: { name: string; email: string; phone: string | null } | null;
  currentUser: CompanySettingsCurrentUser;
  errors: {
    profile: boolean;
    quote: boolean;
    account: boolean;
  };
};
