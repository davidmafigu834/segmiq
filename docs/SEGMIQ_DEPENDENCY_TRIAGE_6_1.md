# Phase 6.1 dependency triage (no blind force upgrades)

Generated as part of urgent remediation. Do **not** run `npm audit fix --force`.

## Summary (npm audit --omit=dev)

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 7 |
| Moderate | 2 |
| Low | 1 |
| **Total** | **12** |

## CRITICAL

### next @ 14.2.35
- Advisories include Image Optimizer DoS, RSC deserialization DoS, request smuggling (GHSA-9g9p-9gw9-jx7f, GHSA-h25m-26qc-wcjf, GHSA-ggv3-7p47-pfv8).
- **Action this phase:** DEFERRED — staying on locked `14.2.35` to avoid App Router breakage without a dedicated upgrade window.
- **Follow-up:** Schedule 14.2.x → latest patched 14.2 (or reviewed 15.x) with full regression.

### next-auth @ ^4.24.11 (lock ~4.24.14)
- Auth.js advisories: email normalizer homoglyph, getToken malformed Bearer, OAuth cookie binding (GHSA-7rqj-j65f-68wh, etc.).
- SegmiQ uses **Credentials** primarily; email/OAuth paths less exposed but Bearer/getToken still relevant for mobile.
- **Action this phase:** DEFERRED (no Auth.js v5 migration). Prefer patch within v4 when available after compatibility check.

## HIGH (selected)

| Package | Notes | Action |
|---|---|---|
| sharp | Image pipeline / libvips CVEs | DEFERRED — upgrade with Next image pipeline test |
| xlsx | Prototype pollution / ReDoS; **no fix** in current line | ACCEPTED residual — constrain uploads; consider `exceljs` later |
| axios | Transitive; prototype pollution / NO_PROXY | DEFERRED — bump when parent allows |
| form-data / nanoid / postcss | Mixed runtime/tooling | Prefer `npm audit fix` (non-force) in maintenance window |

## Policy

No package versions were force-changed in Phase 6.1 for framework criticals.
Security control remediation took priority over framework upgrades.
