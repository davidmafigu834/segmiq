# SegmiQ Important Messages

## 1. Executive summary

Important Messages is a curated dock on the existing notification system. A triangular control sits in the desktop sidebar footer and above the mobile bottom navigation. It opens one panel with All, Collaboration, Approvals, and What's New.

Buyer introduction alerts reuse the Release B `notifications` rows (`type = BUYER_INTRODUCTION`). They are not copied into a second table. What's New has no existing publisher, so a separate announcement table and a platform-admin form were added. That migration has not been applied. Until it is, What's New tells the user that updates are not available yet.

The notification bell is unchanged. The triangle counts only important rows, not every unread notification.

## 2. Concept 4 design interpretation

The control is a compact triangle with a message icon and a lime badge, using the existing sales colour tokens. It does not pulse, bounce, or glow. The panel is about 400px wide on desktop and a bottom sheet on mobile. Empty, loading, and error states are distinct. No mock property photos or invented announcements are shown.

## 3. Hallmark design review

Hallmark v1.1.0 was read from `.cursor/skills/hallmark/SKILL.md`. This is a component inside the existing Workbench shell, so no new token file, preview page, or Hallmark log was created. The dock uses SegmiQ sales tokens, a 44px hit target, visible focus, and `motion-reduce` on the loading skeleton. The pre-emit note is on `components/important-messages/ImportantMessagesDock.tsx`.

## 4. Existing notification architecture

- Table: `notifications` (`user_id`, `type`, `message`, `read`, `client_id`, and, after Release B, `introduction_id`).
- Bell: `components/NotificationBell.tsx` reads `GET /api/notifications`.
- Mark all on the bell: `POST /api/notifications/mark-read` sets `read` for every unread row of the current user.
- There is no realtime subscription on the bell. The dock loads on mount and again every 90 seconds while the panel is open.
- Release B writes one `BUYER_INTRODUCTION` row per recipient. Two managers each have their own row.

## 5. Data-model decisions

Collaboration and approvals are a filtered view of `BUYER_INTRODUCTION` notifications. No second introduction table and no second approval action were added.

What's New could not be represented safely by hard-coded React copy. `supabase/migrations/20261018160000_platform_announcements.sql` adds `platform_announcements` and `platform_announcement_reads`. It was not applied. Drafts and archived rows are not delivered. Read state is per user.

Category policy, one identity per row:

- A reviewer request is `approvals` only.
- An approved or declined notice to the requester is `collaboration`.
- A published announcement is `whats_new`.

The same introduction is not listed twice.

## 6. Desktop trigger implementation

`ImportantMessagesTrigger` renders in the sidebar footer, outside the scrolling nav, in both `SalesSidebar` and `CompanySidebar`. The sidebar is already `fixed`, so the triangle stays put while the page scrolls and while the nav list scrolls. Collapsed width (68px) keeps the 44px control. It is not shown inside the mobile drawer.

## 7. Desktop panel implementation

Opening the triangle sets shared state in `ImportantMessagesProvider`. On viewports at least 1100px wide, a dialog is portalled beside the sidebar using `--sales-sidebar-current-width`. It has a title, unread count, category tabs, Mark all read, close, Escape, outside click, and focus restore through the existing focus trap. The list scrolls inside a capped height.

## 8. Mobile trigger implementation

The same trigger is `position: fixed` at `right-3` and `bottom: var(--sales-mobile-fab-bottom)`, which already clears the 64px nav and the safe area. It is hidden from the `layout:` breakpoint up. It is not rendered when the bottom nav is hidden, and it unmounts while the visual viewport shows the keyboard.

## 9. Mobile sheet implementation

Below 1100px the open state uses `ReSheet` with `placement="bottom"`, so Escape, focus, and scroll lock match other Real Estate sheets. The same categories and rows are used. Choosing a row closes the sheet and navigates to the server-provided path.

## 10. Sidebar integration

- `components/sales/navigation/SalesSidebar.tsx`
- `components/company/navigation/CompanySidebar.tsx`
- Providers: `components/sales/shell/SalesAppShell.tsx` and `components/dashboard/company/CompanyWorkspaceShell.tsx`

Demo guests on the sales shell do not request the feed.

## 11. Bottom navigation and keyboard handling

The triangle does not replace Home, Inbox, Properties, Activities, or Menu. It sits above that bar. Full-screen chat sets `data-hide-mobile-nav` and hides the floating control so it does not cover the composer. The conversation actions menu in `components/inbox/ChatThread.tsx` has an Important messages item on viewports under 1100px. That item opens the sheet through `segmiq:open-important-messages`.

## 12. Categories

All, Collaboration, Approvals, and What's New filter the already loaded feed. Counts and rows come from that payload. An empty category has its own empty label. A failed load shows `ReErrorState` with retry, not an empty success message.

## 13. Unread, read, and dismiss behaviour

The badge is the number of unread important items, compacted to `9+`. Mark read and Mark all read call `POST /api/important-messages/read` for the selected notification ids and announcement ids only. They do not call the bell's mark-all endpoint, so routine notifications stay unread. Reading an approval sets `notifications.read` for that user and does not change the introduction status. One manager reading a row does not update the other manager's row. Dismissing an announcement writes `platform_announcement_reads` for that user only.

## 14. Collaboration notification integration

Requester outcomes map from the existing Release B messages:

- Approved: "Introduction approved" / "Your request to connect with a matching buyer was approved."
- Declined: "Introduction declined" / "Your buyer introduction request was declined."

The stored message is not shown raw. A phone-shaped fragment is stripped if an older row contains one. No buyer name is added.

## 15. Manager approval integration

"Introduction requested…" becomes "Buyer introduction requested" in Approvals, with Review introduction when `introduction_id` is present. Managers go to `/client/buyers/introductions?open={id}`. The widget does not approve or decline. That stays on the Release B queue.

## 16. Agent decision notifications

A salesperson reviewer uses `/sales/buyers/introductions?open={id}`. The requester's approved and declined rows use the same destinations with View introduction or View request. If `introduction_id` is missing, the row has no action, so the widget does not offer a review that cannot be opened.

## 17. What's New announcement architecture

Published rows that match the viewer, are not expired, and are not drafts become What's New items. Notices sort ahead of ordinary updates. The summary is plain text. The optional destination must be an internal path. There are no seeded announcements.

## 18. Announcement publishing permissions

`canPublishAnnouncements` is true only for `SUPER_ADMIN`. Organisation managers and salespeople receive 401 from `POST /api/platform/announcements`. The form is `app/(agency)/dashboard/announcements/page.tsx` and supports draft, preview, publish, and archive. Archive is available after the first save returns an id. If the table is missing, the API returns 503.

## 19. Tenant isolation

The feed selects notifications with `user_id` equal to the signed-in user. Announcement organisation targeting requires `client_id` to match the viewer's organisation. Industry targeting requires `clients.business_type` to match. The server ignores a mismatched audience. Real Estate introduction rows are only created by the Real Estate service, so other industries do not receive them.

## 20. Buyer privacy

Titles and descriptions do not include the buyer name or phone. Declined copy does not say the requester can contact the buyer. Approval in this widget does not grant search editing, WhatsApp, or a commission split. Release A in `lib/real-estate/buyer-contact-access.ts` was not changed.

## 21. Existing notification bell coexistence

The bell still loads `GET /api/notifications` and can show a higher unread count. A shared `BUYER_INTRODUCTION` row uses one `read` flag, so marking it in the dock also clears it in the bell for that user. The triangle does not display the bell total.

## 22. Other-industry compatibility

The dock is on the shared sales and company shells, so Solar, Trades, and other workspaces can receive What's New when the audience allows it. A Real Estate-only announcement does not match another `business_type`. No other industry workflow was changed.

## 23. Components created

- `components/important-messages/ImportantMessagesDock.tsx`
- `components/important-messages/AnnouncementPublisher.tsx`

## 24. Files modified

- `components/sales/navigation/SalesSidebar.tsx`
- `components/company/navigation/CompanySidebar.tsx`
- `components/sales/shell/SalesAppShell.tsx`
- `components/dashboard/company/CompanyWorkspaceShell.tsx`
- `components/inbox/ChatThread.tsx`
- `lib/important-messages/model.ts`
- `lib/important-messages/feed-service.ts`
- `app/api/important-messages/route.ts`
- `app/api/important-messages/read/route.ts`
- `app/api/platform/announcements/route.ts`
- `app/(agency)/dashboard/announcements/page.tsx`

## 25. New migration files

`supabase/migrations/20261018160000_platform_announcements.sql`

Not applied. It does not alter the notifications type check and does not modify older migrations.

Release B's `supabase/migrations/20261018130000_buyer_introduction_decisions.sql` is still a separate, unapplied dependency for `introduction_id` and the `BUYER_INTRODUCTION` type.

## 26. Tests performed

`node .\node_modules\tsx\dist\cli.mjs --test tests\important-messages.test.ts`

Result: 9 passed, 0 failed. These are pure-function tests, not database tests. They cover:

1. One reviewer notification maps to one approval.
2. Manager destination `/client/buyers/introductions`.
3. Salesperson destination `/sales/buyers/introductions`.
4. Unassigned buyers notify active managers, excluding the requester (`introductionNotifyUserIds`).
5. Approved requester copy.
6. Declined requester copy, without a private-contact implication.
7. Read does not mark the approval resolved.
8. A single id is not duplicated across categories.
9. Unread badge ignores read rows and compacts past 9.
10. Draft announcements are hidden.
11. Industry, role, and organisation audiences are enforced.
12. Only `SUPER_ADMIN` can publish.
13. External and protocol-relative links are rejected.
14. A missing introduction id removes the review action.
15. A phone-shaped fragment in stored text is removed.

## 27. Tests not performed

No database integration test was run. No browser pass was run. No full TypeScript check, ESLint, production build, or local server was run. Live manager and salesperson sessions were not exercised. The 90-second refresh, keyboard hide, and chat-menu path were reviewed in source only.

## 28. Deployment prerequisites

1. Confirm Release A (`0e46e1e`) is the production revision before relying on the privacy rules.
2. Review and apply `20261018130000_buyer_introduction_decisions.sql` on its own.
3. Deploy Release B and confirm introduction notifications and the review queues.
4. Deploy this widget. Until step 2 is applied, introduction rows are omitted because `introduction_id` is absent.
5. Review and apply `20261018160000_platform_announcements.sql` separately.
6. Publish real announcements from `/dashboard/announcements` as a platform administrator.
7. Do a visual pass on desktop and mobile. This change was not browser-verified.

Do not apply either migration with a full `supabase db push`.

## 29. Known limitations

- Refresh is on mount and every 90 seconds while open. There is no notification realtime channel to reuse.
- A pending introduction is only under Approvals, so Collaboration does not repeat it.
- What's New stays on the unavailable empty state until the announcement migration is applied and an administrator publishes.
- The admin organisation audience asks for an organisation id. There is no organisation picker.
- The floating triangle is hidden in full-screen chat and while the keyboard is open. Chat users reach the sheet from the conversation actions menu.
- Archive does not create a new row; the draft must be saved first.

## 30. Manual Vercel QA checklist

- Desktop sidebar, expanded and collapsed: triangle stays at the bottom while the nav and the page scroll.
- Open the panel, switch categories, close with the button, outside click, and Escape.
- Badge matches unread important rows and is not the bell total.
- Mark read on an approval, then confirm the introduction is still pending in the review queue.
- Salesperson and manager deep links open the existing introduction pages.
- A non-Real Estate workspace does not show a Real Estate introduction.
- Mobile: triangle clears the bottom nav at 360px and does not sit on the WhatsApp composer.
- Keyboard open hides the triangle.
- Conversation actions on a phone include Important messages.
- Before the announcement migration, What's New explains that updates are not available.
- After it is applied, a draft is invisible to a salesperson and a published audience-matched item appears.
- A manager who is not `SUPER_ADMIN` cannot open the publisher or call the publish API successfully.
