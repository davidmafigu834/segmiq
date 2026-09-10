# SegmiQ operational security verification checklist (Phase 6.1)

Items below are **OPERATIONAL VERIFICATION REQUIRED**.
Code cannot prove cloud/provider configuration.

## Backups

- [ ] Production Postgres automated backups enabled and retention confirmed
- [ ] Point-in-time recovery tested (restore drill date: ______)
- [ ] Cloudflare R2 / object storage backup or versioning verified
- [ ] Encryption keys backed up offline (NEXTAUTH_SECRET, ACCOUNT_SECURITY_ENCRYPTION_KEY, WHATSAPP_SESSION_ENCRYPTION_KEY, WHATSAPP_GATEWAY_SHARED_SECRET)
- [ ] MFA crypto key backup location documented (never casual-rotate)

## Environment isolation

- [ ] Production and staging use **separate** Supabase projects/databases
- [ ] Production and staging use **separate** encryption / NEXTAUTH secrets
- [ ] OAuth / Meta app callbacks point to correct environment
- [ ] WhatsApp gateway secrets differ per environment
- [ ] Cron secrets differ per environment

## CSP

- [ ] Review `/api/security/csp-report` (or logs) for violations over ≥7 days
- [ ] Only then consider `CSP_ENFORCE=true` in production

## Website API keys

- [ ] Confirmed `website_integration_api_key` plaintext row count is 0
- [ ] Run `npx tsx scripts/migrate-website-api-keys.ts` if any legacy rows appear

## MFA rollout

- [ ] `MFA_ENFORCE_SUPER_ADMIN` decision recorded
- [ ] Org MFA policies reviewed with customers before setting `managers`/`all`
