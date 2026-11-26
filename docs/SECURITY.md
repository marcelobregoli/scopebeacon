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
- Persistent SQLite-backed registration and sign-in throttles (registration: 5 attempts/IP/hour; sign-in: 10 attempts/IP and email/15 minutes); rate-limit identifiers are HMAC-hashed rather than stored as raw email/IP values.
- Security response headers including a restrictive Content Security Policy, frame denial, MIME sniffing protection and referrer policy.
- API request bodies limited to 64 KiB.
- Browser state-changing API requests with a mismatched Origin are rejected; session cookies remain HttpOnly and SameSite=Lax.
- Expired sessions and stale rate-limit rows are cleaned on database startup.
- Dependency audit runs in CI.

## Required before handling real client data in production

- Add distributed rate limiting/abuse monitoring if the API is scaled beyond one SQLite-backed instance. Configure the reverse proxy to overwrite client-IP forwarding headers; never trust client-supplied forwarding headers directly.
- Add email verification and password reset with expiring single-use tokens.
- Add a documented CSRF policy if the app is ever deployed cross-site or cookie settings change.
- Configure HTTPS, trusted-proxy handling, security-header review and infrastructure-level request-size limits at the hosting edge.
- Add database backup/restore automation and test recovery.
- Add session cleanup, account deletion/export and audit retention policies.
- Review privacy notice, terms, data retention and jurisdictional requirements.
- Add dependency update automation and scheduled security scans.

## Deployment boundary

The public portfolio demo is a static, read-only sample workspace and does not call the API or require a database. The authenticated Node.js API uses node:sqlite and a local persistent database file; it must not be deployed to an ephemeral serverless filesystem. A future authenticated deployment needs a persistent database/volume (or a deliberate migration to a managed database), a stable high-entropy RATE_LIMIT_SECRET, tested backups/restores, monitoring, email verification/password reset, account export/deletion, and a full privacy/security review. The Node server refuses production startup if RATE_LIMIT_SECRET is missing.

ScopeBeacon remains a portfolio MVP. The hosted demo is not a production client-data system. Do not enter real client data until the remaining controls and deployment architecture are independently reviewed.
