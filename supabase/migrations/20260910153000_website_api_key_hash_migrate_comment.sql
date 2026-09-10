-- Phase 6.1: Legacy website API key plaintext → hash migration
--
-- DO NOT hash keys in SQL (pgcrypto digest encoding can diverge from Node crypto).
-- Prefer the app-level script:
--   npx tsx scripts/migrate-website-api-keys.ts
--
-- That script uses createAdminClient + hashWebsiteApiKey (lib/auth/website-api-keys.ts),
-- sets website_integration_api_key_hash / prefix, and clears website_integration_api_key.
-- Idempotent: only rows with plaintext key and null hash are updated.

comment on column public.clients.website_integration_api_key is
  'DEPRECATED plaintext. Must remain null after migration; auth uses website_integration_api_key_hash only. Run scripts/migrate-website-api-keys.ts for legacy rows.';
