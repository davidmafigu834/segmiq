# Phase 5B — native emulator evidence

Actual Android 11 emulator pixels, 720 × 1280 / 360dp baseline. No generated screen mockups and no production customer data. Fictional fixtures and synthetic local API responses are labelled in the app/test host. Only emulator-5554 was attached; no physical-phone verification is implied.

The full 20-test checkpoint passed with animations disabled. This directory contains 62 PNGs: 53 shared/synthetic captures from that run and nine final form captures replaced from segmiq-phase5b-final-verified. All four affected native tests passed after the final navigation-inset/precision pass (shell-46, 4m, exit 0). Final build, all JVM unit tests and lint passed (shell-47). The original animation setting was restored.

## Improved forms

- [Requirements validation](60-requirements-validation.png)
- [Requirements at 393dp / 150% with keyboard](61-requirements-font150-393dp-keyboard.png)
- [Requirements review](62-requirements-review.png)
- [Offer at 412dp / 200% with keyboard](63-offer-font200-412dp-keyboard.png)
- [Offer review](64-offer-review.png)
- [Confirmed fictional offer](65-offer-confirmed.png)
- [Booking overlap acknowledgement / review](66-booking-overlap-review.png)
- [Reschedule review](67-reschedule-review.png)
- [Synthetic API: confirmed reschedule despite failed refresh](68-confirmed-reschedule-refresh-error.png)

The form captures use native UiAutomation full-screen screenshots after UI idle, including bottom-sheet windows and the OS keyboard. Boundary assertions check the complete review action against the keyboard and system-bar boundary. They are not proof of live deployment or production booking/financial safety.

## Shared screen and workflow regressions

- [Login](01-login-light-360dp.png)
- [Agent Home, fictional](02-home-light-360dp.png)
- [Properties, fictional](03-properties-light-360dp.png)
- [Property detail, fictional](04-property-light-360dp.png)
- [Buyers, fictional](05-buyers-light-360dp.png)
- [Buyer detail, fictional](06-buyer-light-360dp.png)
- [Inquiries, fictional](07-inquiries-light-360dp.png)
- [Calendar, fictional](08-calendar-light-360dp.png)
- [Viewing detail, fictional](09-viewing-light-360dp.png)
- [Dialer](10-dialer-light-360dp.png)
- [Call review](11-review-light-360dp.png)
- [Recorder unavailable](12-recorder-light-360dp.png)
- [Recordings](13-recordings-light-360dp.png)
- [Copilot](14-copilot-light-360dp.png)
- [Inbox, fictional](15-inbox-light-360dp.png)
- [Thread, fictional](16-thread-light-360dp.png)
- [Offers, fictional](17-offers-light-360dp.png)
- [Offer detail, fictional](18-offer-light-360dp.png)
- [Introductions, fictional](19-introductions-light-360dp.png)
- [Transaction, fictional](20-transaction-light-360dp.png)
- [Compliance, fictional](21-compliance-light-360dp.png)
- [Document metadata, fictional](22-document-light-360dp.png)
- [Tasks](23-tasks-light-360dp.png)
- [Dark properties](24-properties-dark-360dp.png)
- [Dark calendar / 150%](25-calendar-dark-font150.png)
- [Login / 200%](26-login-font200.png)
- [Properties / 393dp](27-properties-393dp.png)
- [Buyer / 412dp](28-buyer-412dp.png)
- [Tablet constraints](29-home-tablet-dp-constraints.png)
- [Property action / 200%](30-property-font200-action.png)
- [Image failure](31-image-failure.png)
- [Login keyboard](32-login-keyboard.png)
- [Thread keyboard](33-thread-keyboard.png)
- [Landscape properties](34-properties-landscape.png)
- [Primary navigation / 200%](35-primary-navigation-font200.png)
- [Landscape property action](36-property-landscape-action.png)

## Synthetic API screens

- [Agent Home](40-agent-home-synthetic-api.png)
- [Properties](41-api-properties.png)
- [Property detail](42-api-property-detail.png)
- [Buyers](43-api-buyers.png)
- [Buyer detail](44-api-buyer-detail.png)
- [Matches](45-api-matches.png)
- [Viewings](46-api-viewings.png)
- [Viewing detail](47-api-viewing-detail.png)
- [Introductions](48-api-introductions.png)
- [Introduction detail](49-api-introduction-detail.png)
- [Offers](50-api-offers.png)
- [Offer detail](51-api-offer-detail.png)
- [Transactions](52-api-transactions.png)
- [Transaction detail](53-api-transaction-detail.png)
- [Calendar](54-api-calendar.png)
- [Empty](56-api-empty.png)
- [Error](57-api-error.png)

393dp / 412dp / tablet variants inject Compose density or constraints on the same emulator. Landscape uses Activity rotation. No active recorder screenshot exists because capture is unavailable. Long primary-tab names still wrap at 200%; physical-device and TalkBack checks remain in the release checklist.

See [Phase 5B report](../../phase-5b-real-estate-workflow-polish.md).
