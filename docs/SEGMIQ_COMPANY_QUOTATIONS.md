# SegmiQ Company Quotations

Route: `/client/quotations`

The Company Quotations page is the manager’s operational document workspace. It shows tenant-scoped quotations across the sales team and preserves the distinction between a quotation document and its related commercial opportunity.

## Truth model

- A Quotation belongs to the current Company and a Lead. It may also reference one Deal and one canonical Customer contact.
- Multiple Quotations may reference the same Deal; they remain separate documents and never become separate pipeline opportunities.
- Quotation status and Deal outcome are independent. Accepted does not mark the Deal Won. Declined or Expired does not mark it Lost.
- The displayed owner is the Deal owner when present, then the Lead owner, then the quotation preparer.
- The table Amount and detail Total use the persisted quotation grand total. PDF, builder, and API totals share `lib/quotations/totals.ts`.
- Sent documents are immutable. Changes use the canonical quotation revision flow.

## KPI definitions

The page has exactly seven all-time cards:

1. Total Quotations — all tenant quotation records.
2. Draft — effective status `draft`.
3. Sent — effective status `sent`.
4. Viewed — effective status `viewed`; public quotation links persist `viewed_at`, so this is real tracking.
5. Accepted — effective status `accepted`.
6. Declined — canonical `rejected`, labeled Declined in the UI.
7. Total Value — sum of all non-deleted quotation grand totals across every status. This is quoted value, not revenue or pipeline value.

Status percentages use status count divided by Total Quotations and display 0% for an empty population. Date-based expiry is applied to sent/viewed quotations before status counts and filters.

## Workspace structure

The approved Company shell is reused, including navigation, global search, notifications, theme, profile, collapsed-sidebar preference, mobile header, and bottom navigation.

The main card contains, in order:

- All Quotations, Draft, Sent, Viewed, Accepted, and Declined tabs.
- Search, Owner, Customer, Deal, and More Filters controls.
- Checkbox, Quotation, Customer, Deal, Amount, Status, Owner, Updated, and Actions columns.
- Pagination at ten rows per page, with 25 / 50 options, matching other Company tables.

Search covers quote number/title, Customer name/contact, Deal, and owner. Customer and Deal filters are searchable. More Filters covers Expired, Deal presence, amount range, and quote-date range; Owner/Customer/Deal in the toolbar do not count as More Filters. CSV export contains only the currently filtered tenant-scoped rows; selected-row export is also available. Updated is sortable newest-first by default.

## Quotation detail panel

On large desktop (`xl` and up, including 1440×900), the table stays visible and a 352px right panel opens only after a row is selected. The first quotation is not auto-selected. Smaller desktop/tablet uses a side drawer; mobile uses a bottom sheet. Section order is fixed:

1. Quotation number, status, and close.
2. View PDF, Send/Send Again, and More.
3. Customer/Lead relationship.
4. Deal, Quote Date, Valid Until, Owner, Created, and Last Updated.
5. Amount Summary: Subtotal, negative Other as Discount where present, Tax, and Total.
6. Items, with a bounded five-item preview and explicit expansion.
7. View Full Quotation.

Draft Send opens the canonical builder, which persists items/totals before delivery. Send Again is available only for Sent and Viewed quotations and uses `POST /api/quotations/:id/send` with the canonical WhatsApp message service. It does not change quotation status, Deal outcome, or pipeline stage. Accepted, Declined, and Expired quotations do not expose Send Again. Failed delivery leaves the existing status unchanged. PDF previews do not mark a customer view. Valid Until shows remaining days or a restrained expired warning.

## Actions and permissions

Company managers are tenant-scoped by `canManageQuotationForLead` / `canManageQuotation`. Drafts can be edited and sent. Sent, Viewed, Declined, and Expired quotations can create revisions. Accepted quotations remain locked. Duplicate creates a new draft. Manual Accepted/Declined actions use quotation status only and do not close the Deal.

The loader enforces Company scope before using the service-role client. Owner, Customer, Deal, and create-candidate options are generated only from the selected Company. Super-admin preview requires an explicit permitted Company context.

## Responsive, themes, and states

- Desktop: seven KPI cards in one row from `xl`; table and detail panel align in one row; no lower analytics.
- Tablet: Deal column moves into the detail panel; detail becomes a drawer below 1280px.
- Mobile: 2-column KPI grid prioritizing Total Quotations, Sent, Accepted, and Total Value; quotation cards replace the desktop table; detail becomes a bottom sheet.
- Light and dark modes use existing Sales semantic tokens; lime is limited to the primary action, active tab underline, selected rows, and focus.
- Empty page, empty tab, empty search, empty filters, table load error, and detail load error each have distinct copy and a relevant action. KPI skeletons are shown when the page load fails.

The current Company loader returns tenant rows for client-side interaction, matching other Company workspaces. If quotation history grows to thousands of records, move filtering/pagination to a tenant-scoped server endpoint without changing these UI contracts.
