import { SalesInboxPageView } from "../SalesInboxPageView";

export const dynamic = "force-dynamic";

export default function FollowUpDueInboxPage() {
  return (
    <SalesInboxPageView
      breadcrumb="Sales / WHATSAPP SALES HUB"
      pageTitle="WhatsApp Sales Hub"
      initialFilter="follow_up_due"
    />
  );
}
