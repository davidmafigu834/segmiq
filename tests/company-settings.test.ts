import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeWebsite,
  parseSettingsSlug,
  settingsPath,
  settingsSectionsFor,
  SETTINGS_CATEGORIES,
  SETTINGS_SECTIONS,
  isValidEmail,
} from "../lib/settings/company-settings-config";
import { resolveSettingsAccess } from "../lib/settings/company-settings-access";
import {
  companyInformationRows,
  companyPublicId,
  teamSeatsLabel,
  timezoneLabel,
} from "../lib/settings/company-settings-display";
import type { CompanySettingsProfile, CompanySettingsQuote } from "../lib/settings/company-settings-types";

const profile: CompanySettingsProfile = {
  id: "c1",
  name: "Shield Roofing",
  industry: "Construction",
  slug: "shield-roofing",
  logoUrl: null,
  primaryColor: "#D4FF4F",
  responseTimeLimitHours: 2,
  dialCode: "263",
  website: "shieldroofing.com",
  country: "Zimbabwe",
  ownerEmail: "hello@shield.com",
  assignmentMode: "direct",
  businessType: "trades",
  capabilityTagline: null,
  yearsInOperation: 12,
  facebookPageName: null,
  facebookConnected: false,
  agencyManaged: true,
};

const quote: CompanySettingsQuote = {
  company_address: "12 Industrial Rd",
  company_email: "quotes@shield.com",
  company_website: "https://shieldroofing.com",
  company_phone: "+263 77 000 0000",
  footer_note: null,
  default_terms: null,
  quote_prefix: "Q",
  default_tax_rate: 0,
};

describe("company settings routing", () => {
  it("defaults to company / information", () => {
    assert.deepEqual(parseSettingsSlug(undefined), { category: "company", section: "information" });
    assert.deepEqual(parseSettingsSlug([]), { category: "company", section: "information" });
  });

  it("preserves branding on refresh-equivalent parse", () => {
    assert.deepEqual(parseSettingsSlug(["company", "branding"]), {
      category: "company",
      section: "branding",
    });
    assert.equal(settingsPath("company", "branding"), "/client/settings/company/branding");
  });

  it("collapses the default section in the URL", () => {
    assert.equal(settingsPath("company", "information"), "/client/settings/company");
    assert.equal(settingsPath("security"), "/client/settings/security");
  });

  it("switches left-nav sections with the top category", () => {
    assert.ok(SETTINGS_SECTIONS.company.some((s) => s.id === "information"));
    assert.ok(!SETTINGS_SECTIONS.security.some((s) => s.id === "information"));
    assert.ok(SETTINGS_SECTIONS.automation.some((s) => s.id === "company-brain"));
    assert.equal(parseSettingsSlug(["automation", "company-brain"]).section, "company-brain");
    assert.deepEqual(
      SETTINGS_CATEGORIES,
      ["company", "profile", "team", "notifications", "integrations", "automation", "data", "security"]
    );
  });

  it("only adds Website API for real-estate companies", () => {
    assert.equal(
      settingsSectionsFor("integrations").some((s) => s.id === "website"),
      false
    );
    assert.equal(
      settingsSectionsFor("integrations", { realEstate: true }).some((s) => s.id === "website"),
      true
    );
    assert.equal(parseSettingsSlug(["integrations", "website"]).section, "apps");
    assert.equal(parseSettingsSlug(["integrations", "website"], { realEstate: true }).section, "website");
  });
});

describe("company settings fields", () => {
  it("shows real company information rows and omits invented company size", () => {
    const rows = companyInformationRows(profile, quote);
    assert.deepEqual(
      rows.map((r) => r.label),
      ["Company Name", "Company Email", "Phone Number", "Website", "Industry", "Company ID"]
    );
    assert.equal(rows.find((r) => r.label === "Company Email")?.value, "quotes@shield.com");
    assert.equal(rows.find((r) => r.label === "Company ID")?.value, "shield-roofing");
    assert.equal(
      rows.some((r) => r.label.toLowerCase().includes("size")),
      false
    );
  });

  it("uses the public slug as Company ID, not the database primary key", () => {
    assert.equal(companyPublicId(profile), "shield-roofing");
    assert.notEqual(companyPublicId(profile), profile.id);
  });

  it("normalizes bare website domains", () => {
    assert.equal(normalizeWebsite("segmiq.com"), "https://segmiq.com");
    assert.equal(normalizeWebsite("https://segmiq.com"), "https://segmiq.com");
    assert.equal(normalizeWebsite("  "), null);
  });

  it("validates company email separately from login email rules", () => {
    assert.equal(isValidEmail("ops@shield.com"), true);
    assert.equal(isValidEmail("not-an-email"), false);
  });

  it("formats IANA timezones for display without storing GMT offsets", () => {
    assert.equal(timezoneLabel("Africa/Harare"), "(GMT+2) Harare");
  });

  it("does not invent storage usage in team seat labels", () => {
    assert.equal(teamSeatsLabel({
      planLabel: "Growth",
      status: "active",
      billingCycle: "Monthly",
      nextBillingDate: null,
      teamUsed: 12,
      teamLimit: 15,
      amount: 199,
      currency: "USD",
    }), "12 / 15");
    assert.equal(teamSeatsLabel({
      planLabel: "Scale",
      status: "active",
      billingCycle: "Monthly",
      nextBillingDate: null,
      teamUsed: 8,
      teamLimit: null,
      amount: 349,
      currency: "USD",
    }), "8 / Unlimited");
  });
});

describe("company settings access", () => {
  it("allows company managers and denies team salespeople", () => {
    assert.equal(
      resolveSettingsAccess({ userId: "u", role: "CLIENT_MANAGER", clientId: "c" }),
      "allow"
    );
    assert.equal(
      resolveSettingsAccess({ userId: "u", role: "SALESPERSON", clientId: "c", clientMode: "team" }),
      "deny"
    );
    assert.equal(
      resolveSettingsAccess({ userId: "u", role: "SUPER_ADMIN", clientId: "c" }),
      "allow"
    );
  });
});
