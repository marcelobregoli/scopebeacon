# Security posture and production checklist

## Implemented in the MVP

- scrypt password hashing with a random per-user salt.
- Constant-time password hash comparison.
- Random 256-bit session tokens; only SHA-256 token hashes are stored.
- HttpOnly and SameSite=Lax session cookies; Secure is enabled when `NODE_ENV=production`.
- Session expiration and server-side logout/revocation.
- Server-side Zod validation for request payloads.
- Per-user ownership checks for project, task and milestone operations.
- Public client response is a restricted projection, not a serialized private project record.
- SQLite foreign keys and cascading deletion for owned records.
- Dependency audit runs in CI.

## Required before handling real client data in production

- Add persistent login and registration rate limiting, plus abuse monitoring.
- Add email verification and password reset with expiring single-use tokens.
- Add a documented CSRF policy if the app is ever deployed cross-site or cookie settings change.
- Configure HTTPS, secure headers, request-size limits and trusted-proxy handling.
- Add database backup/restore automation and test recovery.
- Add session cleanup, account deletion/export and audit retention policies.
- Review privacy notice, terms, data retention and jurisdictional requirements.
- Add dependency update automation and scheduled security scans.

ScopeBeacon is a portfolio MVP. Do not use it as a production client-data system until the remaining controls are implemented and reviewed.
