# SegmiQ Sales — milestone 1

## Inspection
The supplied project contained only .idea metadata. No Android modules, documentation, brand assets, backend contracts, Supabase configuration, or authentication implementation were present. The concept image was not attached to this conversation. The supplied colour and layout specification is the visual reference; the text product name is not a replacement official logo.

## Plan
1. Generate a compatible native Compose project and verify the foundation.
2. Add SegmiQ colour tokens, accessible reusable cards and navigation.
3. Build all ten requested screens with isolated, explicitly labelled local demo data.
4. Persist local tasks, notes, messages and call reviews; validate forms and avoid duplicate submissions.
5. Build, test domain behaviour and inspect the app on an available emulator/device.

## Scope boundaries
No production URLs, schemas, credentials or organisation identities are assumed. Demo data must never reach production. Live authentication and production writes require verified contracts and authorisation rules. No microphone or phone permissions are needed for this milestone. Simulated calls must be labelled; recording capture, default-dialer integration, transcription and upload are deferred. No fake audio files, transcripts or upload-success states.

## Future integration
Supply organisation-scoped repository implementations and server-configured pipeline/currency/outcomes. Production sessions require Keystore protection and logout/revoked-access cleanup. Recording metadata and private audio belong in Room/app-private storage in Phase 4. WorkManager sync requires idempotency keys, server version checks and explicit conflict reporting before production writes.
