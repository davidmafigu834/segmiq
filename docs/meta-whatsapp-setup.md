# Meta WhatsApp Cloud API (Business Manager)

Outbound WhatsApp uses the **Graph API** (`POST /{phone-number-id}/messages`) and **approved message templates** only. In-app configuration reads **environment variables** (Vercel, not this UI).

## One-time prerequisites

- Meta Business Verification complete for the business used for Facebook Lead Ads.
- **WhatsApp Business Account (WABA)** created, phone number added and “Leadstaq” display name approved.
- A **System User** with a long-lived token: scopes `whatsapp_business_messaging`, `whatsapp_business_management` (and any your org requires for token creation).
- All **segmiq_*** message templates approved in Business Manager (names hardcoded in `lib/messaging/meta-whatsapp.ts`), language **`en`** (`META_WHATSAPP_TEMPLATE_LANGUAGE`, not `en_US`).

## Webhook (delivery receipts and inbound)

1. Meta Business Manager → your **App** → **WhatsApp** → **Configuration**.
2. **Callback URL:** `https://<your-domain>/api/facebook/webhook` (e.g. `https://segmiq.com/api/facebook/webhook`).
3. **Verify token:** the value of `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` (and/or `FACEBOOK_WEBHOOK_VERIFY_TOKEN` — the GET handler accepts either).
4. **Subscribe to field:** `messages` (required for sent/delivered/read/failed on `message_logs`).

`FACEBOOK_APP_SECRET` must be set: Meta signs the webhook the same way as for Lead Ads.

## Test send

- Use **Graph API Explorer** or the app’s **Test notification** (Agency → Settings) after setting `META_WHATSAPP_PHONE_NUMBER_ID` and `META_WHATSAPP_ACCESS_TOKEN` in Vercel.

## Rollback

- Change `lib/messaging/provider.ts` to call the Twilio implementation instead of `sendWhatsAppViaMeta`, redeploy, and ensure legacy `TWILIO_*` env vars are still set.
