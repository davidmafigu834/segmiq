import { SalesInboxPageView } from "./SalesInboxPageView";

export const dynamic = "force-dynamic";

export default function SalesInboxPage() {
  return (
    <SalesInboxPageView
      breadcrumb="SALES / INBOX"
      pageTitle="WhatsApp Sales Hub"
      fullPage
    />
  );
}
