# Compliance UI/UX upgrade

Hallmark 1.1.0 was loaded before the visual work. The locked system in `design.md` stays in force: modern-minimal, Workbench, existing `sales-*` tokens. The operational meaning of Workbench is one fact, then the next authorised action, then the record. Lime is the primary action. It is not a status colour and not a surface.

Audience: agents, reviewers, managers, and the buyer or seller who receives a document request. Use: see what needs attention and take the next action the server allows. Tone: austere.

## What changed

The compliance screens were restyled in place. Routes, APIs, permissions, status transitions, and the rules engine were left alone. A decision is written only after the existing centre or case API confirms it. The synthetic preview refuses to save.

### Compliance Centre

The overview no longer opens with four equal metric cards. It states how many items are awaiting review, then the queue, with a short side note for changes that are waiting on the customer. Escalations appear only when the count is above zero and the viewer is a manager.

The queue is a table from the `md` breakpoint up, with subject, requirement, submitted time, status, and next action. Below that it is a stacked list. Status labels come from `components/real-estate/compliance/copy.ts`. `submitted` reads “Awaiting review”. Raw enum strings are not shown.

Opening a row keeps the decision on the same page. Verify is the lime button. Request changes opens a dialog and requires a note. Reject is a second confirmation and is not a green button. Escalate stays limited to managers. The panel says private files are not previewed from the queue.

Local navigation covers Overview, Review queue, Buyers, Sellers, Properties, Transactions, and Document requests. Policies and Audit log are shown only when the page passes `manager`. Buyers, sellers, properties, and transactions filter the same queue by case type. They do not call a new endpoint.

### Buyer, seller, property, and transaction

`ContextCompliancePanel` is the same panel on the buyer profile, the owner sheet, the listing, and the transaction. It leads with the status and the count of items that still need attention. Requirements are rows with a semantic badge. One lime action requests documents.

A seller with a real contact id gets this panel inside the existing owner sheet. Unlinked owners do not.

On a transaction, sales progress, compliance readiness, and legal transfer are three separate lines. Payment evidence is described in words, and an uploaded receipt is not called confirmed money. Conveyancing milestones are a list of Record actions. Handover does not claim to register the transfer.

### Customer request

`/verify/c/[token]` stays outside the internal sidebar. The page names the agency, explains the steps, and says that sending the form does not verify identity. A live request still asks for the email code. The form moves through details, documents, and a review step. A selected file is labelled as not yet sent. The success line is “Your information has been submitted successfully.” followed by the agency review sentence.

### Case documents

`ComplianceCasePanel` keeps its existing actions. Document rows are no longer boxed cards. The section mark is ink, not lime. Review states use the info tone instead of the brand tone. Opening a file still uses the existing protected request and does not print the address on the page.

## Components

Reused: `RePageHeader`, `ReSection`, `ReStatusBadge`, `ReEmptyState`, `ReErrorState`, `ReSkeletonRows`, and the sales tokens for brand, danger, borders, and type.

Added: `components/real-estate/compliance/copy.ts` for human labels. The suggested wrapper components were not added. The existing primitives already carry the type, focus, and empty-state behaviour.

## Colour and type

Page titles use the existing display face at 26px on the centre header and 1.5rem on the customer page. Section headings are 15–17px. Body copy is 13–14px. The measured Verify button is `rgb(212, 255, 79)` on `rgb(16, 24, 40)`, 44px tall. Reject is danger text with no fill. Verified, changes requested, and awaiting review use the existing success, warning, and info badges.

## What the server actually provides

The centre payload has counts for pending reviews, changes requested, and escalations. It does not have customer names, an overdue count, or a recently approved count, so those are not shown. The queue subject is the case type. Reviewer ids are not printed.

Document bytes are not in the centre payload. The queue does not invent a viewer. The case panel still opens a stored file through the existing protected route.

There is no separate compliance-officer, finance, or conveyancer flag beyond the existing manager flag and capabilities. Agents do not see Policies or Audit log.

## Browser review

Authenticated centre, buyer, listing, and transaction pages redirect to login without a session. The rendered review used `/dev/compliance-preview`, which calls `notFound()` in production and labels every record as synthetic. Buttons there do not write.

Rendered and inspected:

- Overview at 1440×900. Scroll width matched the viewport. The table has five columns. The decision column sits at the right.
- Decision panel. Verify is lime. Request changes and Escalate are bordered. Reject is red text.
- Request-changes dialog. On a 390px width it measured 358px and fit the screen.
- Buyer verification, with status badges beside each requirement.
- Seller verification, with Company selected.
- Transaction compliance, with the three progress lines, payments, and conveyancing.
- Policies, audit log, and document requests.
- Empty queue: “You're up to date.”
- Error and permission-denied states.
- Customer entry, document step, review, and success.
- Phone overview at 390px. Scroll width was 390. The queue is a list, not a sideways table.

The loading skeleton is the existing `ReSkeletonRows`. It was not given its own screenshot.

A separate property-only screenshot was not taken. Property compliance is the same panel, plus the seller selector, and the transaction rendering covers that panel.

## Tests

`tests/compliance-copy.test.ts` checks that requirement states, payment evidence, and invitation statuses are human labels. It passed with the existing compliance engine tests (21 passed in the combined run, then the label file passed again on its own).

## Before and after

1. Compliance Centre. Before: equal metric cards and a wide table of raw states. After: one sentence for the work that is waiting, then the queue.
2. Review queue. Before: one table with underscored states. After: a dense table on desktop and a stacked row on a phone, with “Awaiting review” and “Changes requested”.
3. Case detail. Before: a tall card and a lime section mark. After: the queue row opens a sticky decision panel, and the existing case sheet uses hairline document rows.
4. Buyer verification. Before: a badge, a raw state, and a wrap of buttons. After: the status as the heading, a short outstanding count, and one request action.
5. Property compliance. Same panel as the buyer, with the seller and legal route the listing already supported.
6. Transaction detail. Before: three raw stages and a cluster of bordered buttons. After: three named lines, a payment sentence that separates evidence from confirmation, and a milestone list.
7. Secure customer form. Before: one long form of bordered fieldsets. After: an entry page, a code step, details, documents, review, and a success page that does not say the person is verified.

## Remaining limits

- The centre cannot show a customer name until the API returns one.
- There is no in-page document zoom. Viewing a file still opens the protected link from the case.
- A new invitation is created only when someone uses Request documents. Opening a dialog does not create one.
- The preview route is for development. Production returns not found, and it must not be used to seed compliance records.
