import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Camera,
  Clock,
  Cloud,
  FileText,
  Globe,
  Home,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  Phone,
  Plug,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  Trophy,
  User,
  Users,
  Workflow,
} from "lucide-react";

export const SHELL_ICONS: Record<string, LucideIcon> = {
  home: Home,
  inbox: Inbox,
  building2: Building2,
  megaphone: Megaphone,
  "message-circle": MessageCircle,
  phone: Phone,
  receipt: Receipt,
  "bar-chart-3": BarChart3,
  bell: Bell,
  settings: Settings,
  users: Users,
  "layout-grid": LayoutGrid,
  "layout-dashboard": LayoutDashboard,
  "layout-template": LayoutTemplate,
  clock: Clock,
  archive: Archive,
  calendar: Calendar,
  trophy: Trophy,
  user: User,
  camera: Camera,
  globe: Globe,
  cloud: Cloud,
  "file-text": FileText,
  shield: ShieldCheck,
  activity: Activity,
  workflow: Workflow,
  plug: Plug,
  sparkles: Sparkles,
  "scroll-text": ScrollText,
  "toggle-left": ToggleLeft,
};

export function ShellIcon({
  name,
  className,
}: {
  name: keyof typeof SHELL_ICONS;
  className?: string;
}) {
  const Icon = SHELL_ICONS[name] ?? Home;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
