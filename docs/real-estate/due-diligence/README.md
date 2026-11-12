# Due diligence

Sale-mandate checks for a Zimbabwe estate agency. An agent records the seller and the property, uploads the documents for that tenure, and the app returns Pass, Conditional pass, or Fail. The score runs from 0 to 100. 80 and above is a pass. 50 to 79 is a conditional pass. Below 50 fails. A higher score is a cleaner file.

The check assists the agent. It does not replace a conveyancer, the Deeds Registry, or the local authority. A title deed stays a conditional pass until someone records that a conveyancer confirmed a Deeds Registry search.

## Where it lives

- Agent: `/sales/due-diligence`
- Manager: `/client/due-diligence`
- Rules, scoring, and the report text: `lib/real-estate/due-diligence`
- API: `/api/clients/[clientId]/due-diligence`
- Tables: `supabase/migrations/20261110130000_real_estate_due_diligence.sql`

The app already uses Next.js, NextAuth, and Supabase, so this feature uses those. There is no second Prisma client. The migration is the schema.

## Turn it on

Use a database you are willing to change. Do not apply the migration to a live project as part of reading this file.

1. Apply `supabase/migrations/20261110130000_real_estate_due_diligence.sql` to that database.
2. Set `RE_DUE_DILIGENCE=on`. While this is unset, the API returns 404 and the pages say the feature is switched off.
3. Document reading uses the same AI the rest of SegmiQ is configured to use. `AGENT_LLM_PROVIDER` selects it. With no explicit provider, a gateway key is used first, then Gemini, then Groq, then Claude. The model is `AI_GATEWAY_MODEL`, `GEMINI_MODEL`, `GROQ_MODEL`, or `ANTHROPIC_MODEL` for that provider. Set `DUE_DILIGENCE_PROVIDER` only to override that choice. Without a configured key, the checklist still runs from the document types the agent selected, and each file is marked unread.
4. Private files use the existing R2 bucket (`CLOUDFLARE_R2_PRIVATE_DOCUMENT_BUCKET_NAME` and its keys). Keys look like `clients/{org}/due-diligence/...`. Without that bucket, uploads are refused.
5. Optional: `SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY`, and `SMILE_ID_BASE_URL` (sandbox default `https://testapi.smileidentity.com`). With `SMILE_ID_PRIVACY_POLICY_URL` set to an https address, a JPEG or PNG National ID, a selfie, and six liveness frames are sent to Smile ID document verification. That compares the selfie with the photo on the ID. Zimbabwe's ID-number product has no photo on file, so a number-only lookup stays Review and is not Clear. Without credentials the check still runs and identity stays Review.

Sign in as an agent on a real-estate company, open Due diligence, and start a mandate.

## What the score means

The file starts at 100. Each failed or open check removes its weight. 80 and above is a pass. 50 to 79 is a conditional pass. Below 50 fails.

A missing critical document, a name mismatch, an ID mismatch, a stand-number mismatch, or an expired rates clearance removes 55 points, so that item alone fails the file. The Deeds Registry search and a council confirmation each remove 25 points, so an otherwise clean title deed or cession stays a conditional pass. An identity result of Review also removes 25 points. An unconfigured identity check removes 10 and does not by itself block a pass. A biometric Fail removes 55 and fails the file. Clear means the document, the face match, and the liveness sequence all passed.

Title deed requires a National ID, the deed, and a rates clearance. A local-authority cession requires a National ID and an agreement of sale with the council. A developer cession requires a National ID, a subdivision permit, and a development permit. Missing rates on a cession is a warning. A printed caveat, bond, or other restriction is a warning. The agent can override a check with a written reason. The next run keeps that override until it is reverted. A failed report cannot be marked cleared.

A failed report, or an asking price of USD 100,000 or more, adds a conveyancer recommendation. That figure is a product prompt, not a statutory threshold.

SI 76 of 2025 and the Digital Land Administration Platform are named on title-deed reports: older paper deeds may need validation against the registry before transfer.

## Tests

```bash
npx tsx --test tests/due-diligence.test.ts
```
