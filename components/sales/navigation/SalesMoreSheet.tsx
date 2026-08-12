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
  resolveSalesNavItems,
  salesMobileMoreItems,
  salesNavItemsBySection,
  SALES_NAV_LUCIDE,
  type SalesNavIconId,
  type SalesNavItemConfig,
} from "@/lib/sales/navigation/sales-nav-config";
import { cn } from "@/lib/ui/cn";

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
                ? "bg-[rgba(212,255,79,0.18)] text-sales-text-primary"
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
  if (!moreOpen) return null;

  const items = resolveSalesNavItems(isSolo);
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
          className="flex min-h-12 w-full items-center gap-3 rounded-[12px] border border-sales-border bg-[rgba(212,255,79,0.14)] px-4 text-left text-[14px] font-semibold text-sales-text-primary"
          onClick={() => {
            close();
            onQuickActions();
          }}
        >
          <Zap size={18} strokeWidth={1.8} className="text-[var(--sales-sidebar-icon-active)]" aria-hidden />
          Quick actions
        </button>

        <section>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
            Sales
          </p>
          <NavRows items={salesMore} pathname={pathname} onNavigate={close} />
        </section>

        <section>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
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
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
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
}: {
  open: boolean;
  onClose: () => void;
  onAddLead: () => void;
  onLogCall: () => void;
  onCreateQuote: () => void;
  onSchedule: () => void;
}) {
  if (!open) return null;

  const actions = [
    { label: "Add lead", icon: UserPlus, run: onAddLead },
    { label: "Log call", icon: PhoneCall, run: onLogCall },
    { label: "Create quote", icon: FilePlus2, run: onCreateQuote },
    { label: "Schedule follow-up", icon: CalendarClock, run: onSchedule },
  ] as const;

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
