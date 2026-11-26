# Security posture and production checklist

## Implemented

- Production Worker password hashing: PBKDF2-SHA256, per-user random 128-bit salt, 310,000 iterations, Web Crypto.
- Local Node development adapter: scrypt with per-user random salt.
- Random 256-bit session tokens; only SHA-256 token hashes are stored.
- HttpOnly, Secure and SameSite=Lax session cookies in the Cloudflare Worker.
- Session expiration and server-side logout/revocation; daily scheduled cleanup.
- Server-side Zod validation and per-user ownership checks.
- Public client response is a restricted projection, not a serialized private project record.
- D1 foreign keys and cascading deletion for owned records.
- Persistent D1-backed registration and sign-in throttles (registration: 5 attempts/IP/hour; sign-in: 10 attempts/IP and email/15 minutes); rate-limit identifiers are HMAC-hashed rather than stored as raw email/IP values.
- Restrictive Content Security Policy and security response headers.
- API request bodies limited to 64 KiB.
- Browser state-changing API requests with a mismatched Origin are rejected; session cookies remain HttpOnly and SameSite=Lax.
- SQL schema versioned as Wrangler D1 migrations.
- Dependency audit and tests run in GitHub Actions.

## Required before handling real client data

- Add email verification and password reset with expiring single-use tokens.
- Add monitoring, alerting and an abuse-response procedure.
- Configure and test D1 backup/export and restore procedures; document recovery objectives.
- Add account deletion/export and privacy/retention controls.
- Review privacy notice, terms and jurisdictional requirements.
- Add dependency update automation and scheduled security scans.
- Conduct an independent deployment and application security review.

## Deployment boundary

Production is a Cloudflare Worker with Workers Static Assets and D1. Local development continues to use a Node/Hono API and local SQLite database. The production Worker does not write to a local filesystem. The D1 database is isolated from other Cloudflare projects and ventures.

ScopeBeacon remains a portfolio MVP, not a reviewed production client-data system. Do not enter real client data until the remaining controls and deployment architecture are independently reviewed.
