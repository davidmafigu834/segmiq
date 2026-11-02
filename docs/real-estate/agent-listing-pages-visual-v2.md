# Agent listing pages — public visual redesign

## What changed

The public property page is now a mobile-first marketing page for the agency, not a stack of beige cards.

- The first screen shows the agency, a shorter photograph, the suburb, the address, the price, and the main facts.
- When currency is not configured, the page says **Price on request**. It does not print a bare number or an internal settings sentence. The company settings screen tells managers to save a quotation currency.
- With no authorised photographs, the hero is a short line drawing and the address sits close underneath. It is not a tall empty block.
- If a photograph request fails, that frame drops out instead of leaving a blank gallery.
- Related homes are image cards. A catalogue link appears only when the agency has a verified catalogue URL. Cards do not pretend to be pages on another website.
- The agent block is “Presented by”, with a name, role, and agency. There are no invented ratings.
- Enquire and viewing stay on the existing APIs. A viewing request still says it is not booked.
- WhatsApp is shown only when a destination exists. The click is still a click event, not a lead.
- Share keeps the current URL, including the agent token.

## Photo delivery

The public media route was selecting `users.is_archived`, which does not exist. That made every attributed photograph fail. The route now uses `is_active`, so approved photographs can load. Signed storage URLs are still not placed in the page or in Open Graph.

The Open Graph image remains a designed text card. It is not a photograph of the property.

## Files

- `components/real-estate/public-listing/PublicListingPage.tsx`
- `components/real-estate/public-listing/property-page.module.css`
- `app/property/[slug]/page.tsx` uses the same unavailable styles
- `app/property/[slug]/opengraph-image.tsx`
- `app/api/public/listing-pages/media/route.ts`
- `lib/real-estate/agent-listing-pages/policy.ts`
- `lib/real-estate/agent-listing-pages/service.ts`
- `components/dashboard/company/settings/ListingPagesSettingsSection.tsx`
- `app/dev/listing-preview/page.tsx` renders a synthetic fixture in development only

## Checks

`tests/agent-listing-pages.test.ts`: 19 passed, including the rule that an unconfigured currency does not become a public price.

Screenshots were taken from `http://localhost:3010/dev/listing-preview` at a 390px phone width and a 1280px desktop width. The photographs in that fixture are a line drawing, not Haven Properties’ real listing. The no-photo case shows the address, “Price on request”, facts, and the agent without a tall empty hero. The enquiry sheet opens from the sticky bar.

## Still true

Attribution, revocation, enquiry creation, and analytics events are unchanged. Page views are still recorded once on the server render, not on each cosmetic update.
