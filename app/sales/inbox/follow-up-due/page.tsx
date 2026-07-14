import { SalesInboxPageView } from "../SalesInboxPageView";

export const dynamic = "force-dynamic";

export default function FollowUpDueInboxPage() {
  return (
    <SalesInboxPageView
      breadcrumb="SALES / WHATSAPP SALES HUB / FOLLOW-UP DUE"
      pageTitle="Follow-up due"
      initialFilter="follow_up_due"
      fullPage
    />
  );
}
