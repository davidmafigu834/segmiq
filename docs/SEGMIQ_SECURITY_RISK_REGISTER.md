# SegmiQ security risk register (Phase 6 snapshot)

| ID | Risk | Severity | Mitigation | Residual |
|---|---|---|---|---|
| R1 | Cross-tenant data access | Critical | Fail-closed guards, tenant helpers, RBAC | Low if guards stay mandatory |
| R2 | Stolen session cookie | High | Idle/absolute TTL, revoke registry, org TTL | Medium (device malware) |
| R3 | CSRF on state-changing APIs | High | Origin check + SameSite | Low on covered routes |
| R4 | Plaintext integration keys | High | Website key hashing; vault for Meta | Website plaintext rows = 0 (verified); rotate Meta if any legacy remains |
| R5 | Impersonation abuse | High | MFA + step-up + reason + TTL + banner + audit | Medium (trusted admins) |
| R6 | Missing MFA on privileged roles | High | Platform + org MFA policy | Depends on org config |
| R7 | Over-broad CSP breakage | Med | Report-Only default; `CSP_ENFORCE` opt-in | Monitor reports |
| R8 | Export abuse | Med | Step-up + org `allowDataExports` | Medium |
| R9 | Log secret leakage | Med | Redaction helpers (Phase 5) | Ongoing discipline |
| R10 | No SSO/SCIM | Med | Explicit non-goal Phase 6 | Accepted for SME tier |

## Explicit non-goals (still accepted)

SSO/SAML/SCIM, SIEM shipping, casual encryption-key rotation, NextAuth replacement.
