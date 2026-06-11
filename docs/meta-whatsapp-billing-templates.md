# Meta WhatsApp — Billing templates

Submit these three **UTILITY** templates in Meta Business Manager before enabling WhatsApp billing notifications. Template names are hardcoded in `lib/messaging/meta-whatsapp.ts`.

Base URL for all URL buttons: your CRM origin (`https://segmiq.com/`). The dynamic button suffix sent by code is `client/billing`.

Language: **English (`en`)** — must match the approved template language in Business Manager (set `META_WHATSAPP_TEMPLATE_LANGUAGE=en`).

---

## segmiq_invoice_issued

**Category:** UTILITY

**Body:**
```
Your Segmiq invoice {{1}} for {{2}} is ready. Payment is due by {{3}}.

Open your billing page to view payment details and upload proof once paid.
```

**Variables:**
| # | Mapping |
|---|---------|
| {{1}} | Invoice number (e.g. SEG-2026-0001) |
| {{2}} | Amount + currency (e.g. USD 199.00) |
| {{3}} | Due date (e.g. Jun 7, 2026) |

**Button:** URL — `https://segmiq.com/{{1}}`  
**Button variable {{1}}:** `client/billing` (dynamic suffix only — no full URL in body)

---

## segmiq_payment_overdue

**Category:** UTILITY

**Body:**
```
Invoice {{1}} for {{2}} is overdue. Your account will be suspended in {{3}} day(s) if payment is not received.

Please pay and upload your proof on the billing page.
```

**Variables:**
| # | Mapping |
|---|---------|
| {{1}} | Invoice number |
| {{2}} | Amount + currency |
| {{3}} | Days until suspension (from subscription grace_days) |

**Button:** URL — `https://segmiq.com/{{1}}`  
**Button variable {{1}}:** `client/billing`

---

## segmiq_payment_confirmed

**Category:** UTILITY

**Body:**
```
Payment confirmed for invoice {{1}} ({{2}}). Your Segmiq account is active.

Your next renewal date is {{3}}.
```

**Variables:**
| # | Mapping |
|---|---------|
| {{1}} | Invoice number |
| {{2}} | Amount + currency |
| {{3}} | Next renewal date |

**Button:** URL — `https://segmiq.com/{{1}}`  
**Button variable {{1}}:** `client/billing`

---

## Notes

- **No trailing variables** — links use the URL button only, not body placeholders.
- **Email always sends** regardless of WhatsApp Meta API configuration.
- Phone numbers are normalised using each client's `dial_code` (263 / 260 / 27 / 254) via `normalizePhoneForWhatsApp` — never a hardcoded country.
- WhatsApp billing sends when `META_WHATSAPP_PHONE_NUMBER_ID` and `META_WHATSAPP_ACCESS_TOKEN` are set.
