"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  CircleHelp,
  FilePlus2,
  PhoneCall,
  UserPlus,
  UserRound,
  Zap,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { useSalesMobileChrome } from "@/components/sales/navigation/SalesMobileChromeContext";
import {
  REAL_ESTATE_SALES_SECTION_ORDER,
  resolveSalesNavItems,
  SALES_NAV_SECTION_LABEL,
  salesMobileMoreItems,
  salesNavItemsBySection,
  SALES_NAV_LUCIDE,
  type SalesNavIconId,
  type SalesNavItemConfig,
} from "@/lib/sales/navigation/sales-nav-config";
import { cn } from "@/lib/ui/cn";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import { isRealEstate } from "@/lib/terminology";
import {
  ReMobileMenuSheet,
  type ReMenuGroup,
  type ReMenuItem,
} from "@/components/real-estate/navigation/ReMobileMenuSheet";

function RowIcon({ icon }: { icon: SalesNavIconId }) {
  if (icon === "whatsapp") {
    return <SiWhatsapp size={18} color="#25D366" aria-hidden />;
  }
  const Icon = SALES_NAV_LUCIDE[icon];
  return <Icon size={18} strokeWidth={1.75} className="text-sales-text-secondary" aria-hidden />;
}

function NavRows({
  items,
  pathname,
  onNavigate,
}: {
  items: SalesNavItemConfig[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            data-course-target={`sales-mobile-more-${item.id}`}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors",
              active
                ? "bg-sales-brand-soft text-sales-text-primary"
                : "text-sales-text-primary hover:bg-sales-surface-hover"
            )}
            aria-current={active ? "page" : undefined}
          >
            <RowIcon icon={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SalesMoreSheet({
  isSolo,
  onQuickActions,
}: {
  isSolo: boolean;
  onQuickActions: () => void;
}) {
  const pathname = usePathname();
  const { moreOpen, setMoreOpen } = useSalesMobileChrome();
  const { businessType, solarWorkflow } = useCompanyWorkspace();
  if (!moreOpen) return null;

  const items = resolveSalesNavItems(isSolo, businessType, { solarWorkflow });

  if (isRealEstate(businessType)) {
    const close = () => setMoreOpen(false);
    const toMenuItem = (item: SalesNavItemConfig): ReMenuItem => ({
      id: item.id,
      label: item.label,
      href: item.href,
      icon: <RowIcon icon={item.icon} />,
      active: item.match(pathname),
      courseTarget: `sales-mobile-more-${item.id}`,
    });
    const groups: ReMenuGroup[] = REAL_ESTATE_SALES_SECTION_ORDER.filter((id) => id !== "main").map((id) => ({
      id,
      label: SALES_NAV_SECTION_LABEL[id],
      items: salesNavItemsBySection(items, id).map(toMenuItem),
    }));
    const system = groups.find((g) => g.id === "system");
    const accountItems: ReMenuItem[] = [
      {
        id: "training",
        label: "Help & Support",
        href: "/sales/training",
        icon: <CircleHelp size={18} strokeWidth={1.75} aria-hidden />,
        active: pathname.startsWith("/sales/training"),
        courseTarget: "sales-mobile-more-training",
      },
      {
        id: "profile",
        label: "My profile",
        href: "/sales/profile",
        icon: <UserRound size={18} strokeWidth={1.75} aria-hidden />,
        active: pathname.startsWith("/sales/profile"),
      },
    ];
    if (system) system.items.push(...accountItems);
    else groups.push({ id: "system", label: SALES_NAV_SECTION_LABEL.system, items: accountItems });

    return (
      <ReMobileMenuSheet
        groups={groups}
        onClose={close}
        onQuickActions={onQuickActions}
        description="Property, buyer and agency work."
      />
    );
  }

  const more = salesMobileMoreItems(items);
  const salesMore = salesNavItemsBySection(more, "sales");
  const toolsMore = salesNavItemsBySection(more, "tools");

  function close() {
    setMoreOpen(false);
  }

  return (
    <PremiumSheet
      title="More"
      description="Sales pages, tools and account."
      onClose={close}
      size="md"
    >
      <div className="space-y-5 pb-[env(safe-area-inset-bottom,0px)]">
        <button
          type="button"
          className="flex min-h-12 w-full items-center gap-3 rounded-sales-md border border-sales-border-subtle bg-sales-brand-soft px-4 text-left text-[14px] font-semibold text-sales-text-primary"
          onClick={() => {
            close();
            onQuickActions();
          }}
        >
          <Zap size={18} strokeWidth={1.8} className="text-[var(--sales-sidebar-icon-active)]" aria-hidden />
          Quick actions
        </button>

        <section>
          <p className="mb-1.5 px-3 text-[11px] font-medium text-sales-text-muted">
            Sales
          </p>
          <NavRows items={salesMore} pathname={pathname} onNavigate={close} />
        </section>

        <section>
          <p className="mb-1.5 px-3 text-[11px] font-medium text-sales-text-muted">
            Tools
          </p>
          <NavRows items={toolsMore} pathname={pathname} onNavigate={close} />
          <Link
            href="/sales/training"
            onClick={close}
            data-course-target="sales-mobile-more-training"
            className="mt-0.5 flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
          >
            <CircleHelp size={18} strokeWidth={1.75} className="text-sales-text-secondary" aria-hidden />
            Training
          </Link>
        </section>

        <section>
          <p className="mb-1.5 px-3 text-[11px] font-medium text-sales-text-muted">
            Account
          </p>
          <Link
            href="/sales/profile"
            onClick={close}
            className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
          >
            <UserRound size={18} strokeWidth={1.75} className="text-sales-text-secondary" aria-hidden />
            My profile
          </Link>
        </section>
      </div>
    </PremiumSheet>
  );
}

export function SalesMobileQuickActionsSheet({
  open,
  onClose,
  onAddLead,
  onLogCall,
  onCreateQuote,
  onSchedule,
  realEstate = false,
}: {
  open: boolean;
  onClose: () => void;
  onAddLead: () => void;
  onLogCall: () => void;
  onCreateQuote: () => void;
  onSchedule: () => void;
  realEstate?: boolean;
}) {
  if (!open) return null;

  const actions = realEstate
    ? [
        { label: "Add inquiry", icon: UserPlus, run: onAddLead },
        { label: "Log call", icon: PhoneCall, run: onLogCall },
        { label: "Schedule follow-up", icon: CalendarClock, run: onSchedule },
      ]
    : [
        { label: "Add lead", icon: UserPlus, run: onAddLead },
        { label: "Log call", icon: PhoneCall, run: onLogCall },
        { label: "Create quote", icon: FilePlus2, run: onCreateQuote },
        { label: "Schedule follow-up", icon: CalendarClock, run: onSchedule },
      ];

  return (
    <PremiumSheet
      title="Quick actions"
      description="Start the sales actions you use most."
      onClose={onClose}
      size="sm"
    >
      <div className="space-y-1 pb-[env(safe-area-inset-bottom,0px)]">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[14px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
            onClick={() => {
              onClose();
              a.run();
            }}
          >
            <a.icon size={18} strokeWidth={1.75} className="text-sales-text-secondary" aria-hidden />
            {a.label}
          </button>
        ))}
      </div>
    </PremiumSheet>
  );
}
