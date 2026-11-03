# Real-estate compliance Phase 1 feature matrix

| Feature | Implemented | Backend connected | Tested | Production ready | Blocker |
| --- | --- | --- | --- | --- | --- |
| Buyer verification on the existing buyer profile | Yes | Yes | UI path wired; engine tested | No | Web app not deployed |
| Individual and company checklists | Yes | Yes | Template tests | No | Professional policy review required before enforcement |
| Seller verification linked to the contact | Yes | Yes | Engine tests | No | Web app not deployed |
| Property listing readiness | Yes | Yes | Route applicability tested | No | Enforcement stays off until a reviewed policy |
| Listing approval left intact | Yes | Yes | Existing gate plus optional block tested | No | None beyond deployment review |
| Public marketing hides private KYC | Yes | Yes | Gate test | No | Private bucket must be confirmed in the target environment |
| Transaction commercial, compliance and legal dimensions | Yes | Yes | Payment and transfer tests | No | Web app not deployed |
| Agreement, payment and conveyancing sections | Yes | Yes | State tests | No | No external conveyancer portal |
| Payment proof is not confirmation | Yes | Yes | Unit tests | No | Web app not deployed |
| Secure customer invitation | Yes | Yes | Expiry, revocation, token tests, and browser check of the closed form | No | Email delivery must be configured |
| Email code before the form opens | Yes | Yes | OTP lockout tested; live form stays closed without a code | No | Contact needs an email; SMS is not connected |
| Evidence versions | Yes | Yes | Upload does not verify | No | Malware scanner not connected |
| Review queue and decisions | Yes | Yes | Decision rules tested | No | Web app not deployed |
| Restricted escalation masking | Yes | Yes | Agent label tested | No | Web app not deployed |
| Policy versions | Yes | Yes | Engine only | No | Do not activate without a qualified review |
| Audit history without identity numbers | Yes | Yes | Summary test | No | Web app not deployed |
| Work items that do not auto-verify | Yes | Yes | Service contract | No | Not the same list as lead tasks |
| Mobile summary API | Yes | Yes | Auth uses the session organisation | No | Not deployed |
| AI document intelligence | No | No | Not applicable | No | Deferred. Phase 1 must stay deterministic |
