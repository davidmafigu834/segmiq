# Phase 5A Android rollout manifest

Decision: **KEEP PRODUCTION REAL ESTATE GATES DISABLED. No modules or operations are approved.**

The canonical machine-readable manifest is evidence/phase5a-rollout-manifest.json. The evidence
is evidence/phase5a-observations.json and evidence/phase5a-operation-matrix.json. Full findings,
migration requirements, source fixes, test limitations and operator steps are in
05-real-estate-production-acceptance.md.

## Current manifest

```json
{
  "schemaVersion": 1,
  "backendOrigin": "https://www.segmiq.com",
  "originStatus": "REACHABLE_NOT_ACCEPTED",
  "deployedRevision": null,
  "sourceRevision": "ebe1a5807fbaa5c2dd125f6fa779751b5031e0c0",
  "sourceIncludesUncommittedPhase5AFixes": true,
  "contractVersion": 1,
  "contractVersionProvenance": "SOURCE_NOT_AUTHENTICATED_LIVE",
  "deployedVerification": "NOT_ATTESTED",
  "approvedModules": [],
  "approvedOperations": [],
  "approvedSignedImageHost": null,
  "verificationDate": null,
  "observationsRecordedAt": "2026-10-31T15:13:58.296266Z",
  "evidenceReferences": [
    "evidence/phase5a-observations.json",
    "evidence/phase5a-operation-matrix.json",
    "05-real-estate-production-acceptance.md"
  ],
  "restrictions": [
    "Keep all Phase 4 Real Estate production rollout gates disabled.",
    "Invalid-token denial does not prove a real revoked session is denied.",
    "Do not execute financial writes until the approved compliance baseline and revision wrapper are installed and tested.",
    "Do not enable property photographs or document downloads until private policies, object migration, expiry and host behavior pass.",
    "Local fixture tests are not deployed acceptance.",
    "Calendar remains bounded; standalone appointments and meetings are not certified."
  ],
  "rollbackRequirements": [
    "Disable affected Android module/operation gates before rollback.",
    "Remove or expire any operation acceptance packet; never substitute another origin/revision.",
    "Restore reviewed application artifact, not vulnerable public media access.",
    "Use approved object/reference manifest to reverse storage changes; do not delete originals without separate approval.",
    "Obtain a reviewed forward/rollback database plan before any migration; never reset production."
  ],
  "operationsRejectedByDefault": true
}
```

## Android consumption rules

- Reject an approval with null/unproven deployed revision, an origin/revision/contract mismatch,
  expired validity, an unapproved actor role or missing independent per-operation evidence.
- Empty approvedModules/approvedOperations is an explicit deny-all for this new rollout,
  not a reason to infer permission from existing capability flags or source support.
- An existing flag, a compiling repository, an invalid-token 401, database index definitions or
  a manually edited NOT_ATTESTED string cannot satisfy acceptance.
- Keep existing independently approved General/Solar/authentication behavior unchanged; this
  manifest applies to the newly gated Real Estate Phase 4 rollout only.
- Do not substitute public media URLs, web cookies, Supabase credentials, fictional records,
  a different backend origin or a more permissive module to bypass a missing approval.
- approvedSignedImageHost=null forbids actual private image activation. Do not send the Sales
  token to a signed-media host, follow arbitrary cross-host redirects, or publish temporary URLs.
- Writes require their OWN acceptance records. Read acceptance never enables notifications,
  financial decisions, document approval, reassignment or customer messaging automatically.
- Calendar remains partial/bounded even after its read operation is accepted; never invent
  standalone meetings or appointments that have no certified source.

## Evidence required to replace the blocked manifest

Bind every observation to canonical backend origin, authenticated deployed SHA, contract version,
module, read/write/sign operation, actor role, independent tenant/actor aliases, expected outcome,
observed result, migration/storage state, timestamp and a retained redacted report hash. Verify
before and after the test that all identities hit the same release. Do not approve globally
from one role's successful request. Reviewer identity and validity period must be explicit.

Provision (or identify) an authorized isolated origin and synthetic fixtures first; never seed
or attack customer records. Then execute list/detail/history/document privacy checks, actual
revoked-session and subscription tests, database races and private storage expiry/host checks.
Verify API-to-database binding and install only explicitly approved, tested migrations. Record
rollback requirements before rollout, and enable narrowly by operation and role after review.

No credentials belong in the fixture manifest or these evidence files. Supply credentials
through an approved secret mechanism, redact bodies/tokens from logs, and retain fixture/customer
separation. The new source image-evidence validator is defense in depth, not self-certification.
