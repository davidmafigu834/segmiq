# Phase 4 native Android screenshot gallery

All captures are real emulator pixels from the implemented Compose application. None is a generated UI mockup or evidence of live customer reads. The emulator is Android 11, 720×1280, approximately 360dp wide.

Full combined build/unit/lint/instrumentation check passed all 16 tests. Final build/unit/lint plus both changed API/navigation tests passed again after contract and UI refinements. The gallery has 53 PNGs; its 16 typed-API frames are from that final targeted run. No tests were disabled.

## Data classification

- **40–57:** synthetic HTTP fixtures rendered through typed EstateRepository / ViewModel / native screens. The new API-screen captures have an explicit SYNTHETIC API banner. Agent Home uses the existing synthetic shared-service test.
- **01–36:** current-run shared/premium regression captures with clearly fictional local fixtures. Compliance/documents are examples, not authorised real file transfers.
- Generated architectural decoration in the fictional preview is identified in the application. New API listing screens use neutral unavailable-photo states.
- No active recorder capture exists. Capture export and final verification status are recorded in the [Phase 4 report](../../phase-4-real-estate-live-integration.md).

Native keyboard captures 32/33 retain the previously documented action-clearance limitation; passing semantics assertions do not certify pixel clearance. 393/412dp/tablet variants inject layout density/constraints on the same emulator. Landscape uses actual Activity rotation. These are not physical-phone/tablet certifications.

## Synthetic API screens

| Area | Capture |
|---|---|
| Agent Home | [40 — Home](40-agent-home-synthetic-api.png) |
| Properties | [41 — Directory](41-api-properties.png), [42 — Detail](42-api-property-detail.png) |
| Buyers | [43 — Directory](43-api-buyers.png), [44 — Requirements](44-api-buyer-detail.png) |
| Matching | [45 — Server-provided matches](45-api-matches.png) |
| Viewings | [46 — Agenda](46-api-viewings.png), [47 — Property-only detail](47-api-viewing-detail.png) |
| Introductions | [48 — Directory](48-api-introductions.png), [49 — Own request detail](49-api-introduction-detail.png) |
| Offers | [50 — Directory](50-api-offers.png), [51 — Detail](51-api-offer-detail.png) |
| Transactions | [52 — Directory](52-api-transactions.png), [53 — Milestones](53-api-transaction-detail.png) |
| Calendar | [54 — Bounded feed](54-api-calendar.png) |
| Empty / error | [56 — Empty](56-api-empty.png), [57 — Safe server error](57-api-error.png) |

## Shared and fictional regression captures

| Area | Capture |
|---|---|
| Login / home | [01](01-login-light-360dp.png), [02](02-home-light-360dp.png) |
| Fictional properties/detail | [03](03-properties-light-360dp.png), [04](04-property-light-360dp.png) |
| Fictional buyers/detail | [05](05-buyers-light-360dp.png), [06](06-buyer-light-360dp.png) |
| Inquiries / calendar / viewing | [07](07-inquiries-light-360dp.png), [08](08-calendar-light-360dp.png), [09](09-viewing-light-360dp.png) |
| Dialer / review / unavailable recorder | [10](10-dialer-light-360dp.png), [11](11-review-light-360dp.png), [12](12-recorder-light-360dp.png) |
| Library / Copilot | [13](13-recordings-light-360dp.png), [14](14-copilot-light-360dp.png) |
| Inbox / draft thread | [15](15-inbox-light-360dp.png), [16](16-thread-light-360dp.png) |
| Fictional offers / introductions | [17](17-offers-light-360dp.png), [18](18-offer-light-360dp.png), [19](19-introductions-light-360dp.png) |
| Fictional transaction / compliance / document | [20](20-transaction-light-360dp.png), [21](21-compliance-light-360dp.png), [22](22-document-light-360dp.png) |
| Tasks / dark properties | [23](23-tasks-light-360dp.png), [24](24-properties-dark-360dp.png) |
| Large text | [25 — 150%](25-calendar-dark-font150.png), [26 — 200% login](26-login-font200.png), [30 — Action](30-property-font200-action.png), [35 — Navigation](35-primary-navigation-font200.png) |
| Width constraints | [27 — 393dp](27-properties-393dp.png), [28 — 412dp](28-buyer-412dp.png), [29 — Tablet constraints](29-home-tablet-dp-constraints.png) |
| Image failure | [31](31-image-failure.png) |
| Keyboard | [32](32-login-keyboard.png), [33](33-thread-keyboard.png) |
| Landscape | [34](34-properties-landscape.png), [36](36-property-landscape-action.png) |
