"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanySettingsHeader } from "./CompanySettingsHeader";
import { SettingsCategoryTabs } from "./SettingsCategoryTabs";
import { SettingsSectionNav } from "./SettingsSectionNav";
import { CompanyInformationSection } from "./CompanyInformationViews";
import {
  CompanyAutomationSection,
  CompanyBrandingSection,
  CompanyBusinessDetailsSection,
  CompanyDataSection,
  CompanyLocalizationSection,
  CompanyPreferencesSection,
  CompanySubscriptionSection,
} from "./CompanySectionViews";
import { CompanyContextRail, SettingsNeedHelpCard } from "./CompanySettingsRail";
import {
  ProfileAccountSection,
  ProfileAppearanceSection,
  ProfileHelpRail,
  ProfilePersonalSection,
  NotificationsAlertsSection,
} from "./ProfileSettingsViews";
import { TeamMembersSection } from "./TeamSettingsViews";
import {
  IntegrationsAppsSection,
  IntegrationsWebsiteSection,
  IntegrationsWhatsAppSection,
} from "./IntegrationsSettingsViews";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { ToastProvider, useSalesToast } from "@/components/sales/ui";
import {
  settingsPath,
  settingsSectionsFor,
  type SettingsCategory,
} from "@/lib/settings/company-settings-config";
import type {
  CompanySettingsPageData,
  CompanySettingsProfile,
  CompanySettingsQuote,
  CompanySettingsCurrentUser,
} from "@/lib/settings/company-settings-types";
import type { UserRole } from "@/types";

export function CompanySettingsPage(props: {
  data: CompanySettingsPageData;
  category: SettingsCategory;
  section: string;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge?: number;
  previewClientId?: string | null;
}) {
  return (
    <ToastProvider>
      <CompanySettingsPageInner {...props} />
    </ToastProvider>
  );
}

function CompanySettingsPageInner({
  data,
  category,
  section,
  unreadNotifications,
  notificationRole,
  whatsappBadge = 0,
  previewClientId,
}: {
  data: CompanySettingsPageData;
  category: SettingsCategory;
  section: string;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge?: number;
  previewClientId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const [profile, setProfile] = useState(data.profile);
  const [quote, setQuote] = useState(data.quote);
  const [timezone, setTimezone] = useState(data.timezone);
  const [operatingHours, setOperatingHours] = useState(data.operatingHours);
  const [user, setUser] = useState(data.currentUser);
  const [sectionSheet, setSectionSheet] = useState(false);

  useEffect(() => {
    setProfile(data.profile);
    setQuote(data.quote);
    setTimezone(data.timezone);
    setOperatingHours(data.operatingHours);
    setUser(data.currentUser);
  }, [data]);

  const realEstate = profile.businessType === "real_estate";
  const sections = settingsSectionsFor(category, { realEstate });
  const activeSection = sections.some((s) => s.id === section) ? section : sections[0]?.id ?? section;
  const sectionLabel = sections.find((s) => s.id === activeSection)?.label ?? "Section";
  const helpEmail = data.agencyContact?.email || null;

  const showCompanyRail = category === "company";
  const showProfileRail = category === "profile" || category === "security";
  const hideRail =
    category === "team" ||
    (category === "integrations" && activeSection === "whatsapp") ||
    (category === "integrations" && activeSection === "website");

  function go(nextCategory: SettingsCategory, nextSection?: string) {
    router.push(settingsPath(nextCategory, nextSection, previewClientId));
  }

  function onProfileChange(next: Partial<CompanySettingsProfile>) {
    setProfile((prev) => ({ ...prev, ...next }));
  }
  function onQuoteChange(next: Partial<CompanySettingsQuote>) {
    setQuote((prev) => ({ ...prev, ...next }));
  }
  function onUserChange(next: Partial<CompanySettingsCurrentUser>) {
    setUser((prev) => ({ ...prev, ...next }));
  }

  return (
    <CompanyWorkspaceShell
      companyName={profile.name}
      companyLogoUrl={profile.logoUrl}
      userName={user.name}
      avatarUrl={user.avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
    >
      <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden pb-8">
        <CompanySettingsHeader
          unreadNotifications={unreadNotifications}
          notificationRole={notificationRole}
          userName={user.name}
          avatarUrl={user.avatarUrl}
        />
        <SettingsCategoryTabs active={category} previewClientId={previewClientId} />

        <button
          type="button"
          className="flex h-11 items-center justify-between rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] font-medium text-sales-text-primary layout:hidden"
          onClick={() => setSectionSheet(true)}
        >
          {sectionLabel}
          <ChevronDown size={16} className="text-sales-text-muted" />
        </button>

        <div
          className={
            hideRail
              ? "grid min-w-0 grid-cols-1 gap-5 layout:grid-cols-[220px_minmax(0,1fr)]"
              : "grid min-w-0 grid-cols-1 gap-5 layout:grid-cols-[220px_minmax(0,1fr)_320px]"
          }
        >
          <aside className="hidden min-w-0 layout:block">
            <SettingsSectionNav
              sections={sections}
              active={activeSection}
              onSelect={(id) => go(category, id)}
            />
          </aside>

          <div className="min-w-0">
            {category === "company" && activeSection === "information" ? (
              <CompanyInformationSection
                clientId={data.clientId}
                profile={profile}
                quote={quote}
                timezone={timezone}
                operatingHours={operatingHours}
                profileError={data.errors.profile}
                quoteError={data.errors.quote}
                onRetry={() => router.refresh()}
                onProfileChange={onProfileChange}
                onQuoteChange={onQuoteChange}
                onTimezoneChange={setTimezone}
                onOperatingHoursChange={setOperatingHours}
                toast={toast}
              />
            ) : null}
            {category === "company" && activeSection === "branding" ? (
              <CompanyBrandingSection
                clientId={data.clientId}
                profile={profile}
                quote={quote}
                onProfileChange={onProfileChange}
                onQuoteChange={onQuoteChange}
                toast={toast}
              />
            ) : null}
            {category === "company" && activeSection === "business" ? (
              <CompanyBusinessDetailsSection
                clientId={data.clientId}
                profile={profile}
                onProfileChange={onProfileChange}
                toast={toast}
              />
            ) : null}
            {category === "company" && activeSection === "localization" ? (
              <CompanyLocalizationSection
                clientId={data.clientId}
                profile={profile}
                timezone={timezone}
                onProfileChange={onProfileChange}
                onTimezoneChange={setTimezone}
                toast={toast}
              />
            ) : null}
            {category === "company" && activeSection === "subscription" ? (
              <CompanySubscriptionSection
                account={data.account}
                accountError={data.errors.account}
                onRetry={() => router.refresh()}
              />
            ) : null}
            {category === "company" && activeSection === "preferences" ? (
              <CompanyPreferencesSection
                clientId={data.clientId}
                quote={quote}
                profile={profile}
                onQuoteChange={onQuoteChange}
                onProfileChange={onProfileChange}
                toast={toast}
              />
            ) : null}

            {category === "profile" && activeSection === "personal" ? (
              <ProfilePersonalSection
                user={user}
                companyName={profile.name}
                onUserChange={onUserChange}
                toast={toast}
              />
            ) : null}
            {category === "profile" && activeSection === "account" ? (
              <ProfileAccountSection toast={toast} />
            ) : null}
            {category === "profile" && activeSection === "appearance" ? (
              <ProfileAppearanceSection />
            ) : null}

            {category === "team" ? (
              <TeamMembersSection clientId={data.clientId} currentUserId={user.id} toast={toast} />
            ) : null}

            {category === "notifications" ? (
              <NotificationsAlertsSection user={user} onUserChange={onUserChange} toast={toast} />
            ) : null}

            {category === "integrations" && activeSection === "apps" ? (
              <IntegrationsAppsSection
                facebookConnected={profile.facebookConnected}
                facebookPageName={profile.facebookPageName}
                helpEmail={helpEmail}
                onManageWhatsApp={() => go("integrations", "whatsapp")}
              />
            ) : null}
            {category === "integrations" && activeSection === "whatsapp" ? <IntegrationsWhatsAppSection /> : null}
            {category === "integrations" && activeSection === "website" && realEstate ? (
              <IntegrationsWebsiteSection clientId={data.clientId} />
            ) : null}

            {category === "automation" ? (
              <CompanyAutomationSection
                clientId={data.clientId}
                profile={profile}
                onProfileChange={onProfileChange}
                toast={toast}
              />
            ) : null}

            {category === "data" ? <CompanyDataSection /> : null}

            {category === "security" ? <ProfileAccountSection toast={toast} /> : null}

            {showCompanyRail ? (
              <div className="mt-4 layout:hidden">
                <CompanyContextRail
                  account={data.account}
                  accountError={data.errors.account}
                  helpEmail={helpEmail}
                  onRetryAccount={() => router.refresh()}
                />
              </div>
            ) : null}
            {showProfileRail && !hideRail ? (
              <div className="mt-4 layout:hidden">
                <ProfileHelpRail email={helpEmail} />
              </div>
            ) : null}
            {category === "integrations" && activeSection === "apps" ? (
              <div className="mt-4 layout:hidden">
                <SettingsNeedHelpCard
                  email={helpEmail}
                  copy="Need help connecting WhatsApp or Facebook Lead Ads? SegmiQ support can help."
                />
              </div>
            ) : null}
          </div>

          {hideRail ? null : (
            <aside className="hidden min-w-0 layout:block">
              {showCompanyRail ? (
                <CompanyContextRail
                  account={data.account}
                  accountError={data.errors.account}
                  helpEmail={helpEmail}
                  onRetryAccount={() => router.refresh()}
                />
              ) : showProfileRail ? (
                <ProfileHelpRail email={helpEmail} />
              ) : category === "integrations" ? (
                <SettingsNeedHelpCard
                  email={helpEmail}
                  copy="Need help connecting WhatsApp or Facebook Lead Ads? SegmiQ support can help."
                />
              ) : category === "automation" ? (
                <SettingsNeedHelpCard
                  email={helpEmail}
                  copy="Lead assignment uses the existing routing engine. Contact support if routing looks wrong."
                />
              ) : category === "data" ? (
                <SettingsNeedHelpCard
                  email={helpEmail}
                  copy="Exports run from Reports and stay inside this company."
                />
              ) : category === "notifications" ? (
                <SettingsNeedHelpCard
                  email={helpEmail}
                  copy="System alerts from SegmiQ cannot be turned off."
                />
              ) : null}
            </aside>
          )}
        </div>
      </div>

      {sectionSheet ? (
        <PremiumSheet title="Settings sections" onClose={() => setSectionSheet(false)} size="sm">
          <SettingsSectionNav
            sections={sections}
            active={activeSection}
            onSelect={(id) => {
              setSectionSheet(false);
              go(category, id);
            }}
          />
        </PremiumSheet>
      ) : null}
    </CompanyWorkspaceShell>
  );
}
