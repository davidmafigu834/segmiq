# Phase 6 screenshots

Captured on the Android 11 emulator `SolarCare_API_30` (API 30) during the passing `connectedDebugAndroidTest` run on 2026-10-31.

These images are synthetic fixtures rendered by the instrumented tests. They are not live customer records and they are not proof of production data access.

| File | Screen |
|---|---|
| `40-agent-home-synthetic-api.png` | Real Estate home against a local synthetic API |
| `41-api-properties.png` | Property directory |
| `42-api-property-detail.png` | Property detail |
| `43-api-buyers.png` | Buyers |
| `44-api-buyer-detail.png` | Buyer requirements |
| `45-api-matches.png` | Matching |
| `54-api-calendar.png` | Calendar |
| `46-api-viewings.png` | Viewings |
| `47-api-viewing-detail.png` | Viewing detail |
| `48-api-introductions.png` | Introductions |
| `49-api-introduction-detail.png` | Introduction detail |
| `50-api-offers.png` | Offers |
| `51-api-offer-detail.png` | Offer detail |
| `52-api-transactions.png` | Transactions |
| `53-api-transaction-detail.png` | Transaction detail |
| `14-copilot-light-360dp.png` | Sales Copilot |
| `56-api-empty.png` | Empty authorised feed |
| `57-api-error.png` | Error state |

The home capture still shows gated module copy because that test uses a local MockWebServer origin, which the production release manifest correctly refuses. Live reads open only for `https://www.segmiq.com:443` at revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`.
