import {
  CalendarClock,
  FileText,
  Handshake,
  MapPin,
  Phone,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { CompanyCalendarEventKind } from "@/lib/sales/company-calendar/types";

export function CompanyCalendarEventIcon({
  kind,
  size = 14,
}: {
  kind: CompanyCalendarEventKind;
  size?: number;
}) {
  if (kind === "whatsapp") return <SiWhatsapp size={size} color="#25D366" aria-hidden />;
  if (kind === "call") return <Phone size={size} strokeWidth={1.8} aria-hidden />;
  if (kind === "quote_review") return <FileText size={size} strokeWidth={1.8} aria-hidden />;
  if (kind === "deal_action") return <Handshake size={size} strokeWidth={1.8} aria-hidden />;
  if (kind === "site_visit") return <MapPin size={size} strokeWidth={1.8} aria-hidden />;
  return <CalendarClock size={size} strokeWidth={1.8} aria-hidden />;
}
