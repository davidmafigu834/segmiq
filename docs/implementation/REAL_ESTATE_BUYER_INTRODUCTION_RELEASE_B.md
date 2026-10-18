# Buyer introduction Release B

Release A is commit `0e46e1e` on `main`. It was pushed to GitHub. This session did not confirm a Vercel production deployment, so production may still be serving the previous privacy behaviour until that commit is deployed.

Release B is a separate changeset. Do not fold it into a Release A-only deploy. The database migration `supabase/migrations/20261018130000_buyer_introduction_decisions.sql` is not applied. Review decisions and introduction notifications need that migration. Until it is applied, a review returns a clear unavailable response and does not change a request.

Release B does not weaken `lib/real-estate/buyer-contact-access.ts`. An accepted introduction still does not open the buyer search, create a transaction, or create a commission. The old “Open search to schedule a viewing” link is removed.
