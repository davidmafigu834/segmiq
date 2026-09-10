# SegmiQ incident response (account & tenant)

## Severity

| Sev | Example | First response |
|---|---|---|
| S1 | Confirmed account takeover / mass data export | Revoke sessions, suspend client, rotate secrets |
| S2 | Suspected credential stuffing / MFA bypass attempt | Force password reset, revoke sessions, review audit |
| S3 | Single user lockout / lost authenticator | Admin MFA reset with step-up + notify user |

## Playbooks

### Account takeover

1. Identify `user_id` / `client_id` from `security_events`  
2. Bump `users.session_version` or revoke all `user_sessions`  
3. Disable user (`is_active=false`) if needed  
4. Reset password + MFA admin reset  
5. Notify user via security alert email  

### Tenant breach / malicious insider

1. Set `security_suspended_at` on `clients`  
2. Revoke website API key + Meta tokens as needed  
3. Export org audit CSV for evidence  
4. Clear suspend after remediation  

### Impersonation abuse

1. Review `IMPERSONATION_STARTED` events (reason, realUserId)  
2. Revoke admin sessions; require MFA re-enrol if compromised  

### Lost MFA (legit user)

Use `POST /api/auth/admin/mfa-reset` (platform) with step-up — no self-service bypass.
