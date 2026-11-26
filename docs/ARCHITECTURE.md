# Architecture

## Production topology

```text
Browser
  ├── React + TypeScript static assets (Cloudflare Workers Static Assets)
  └── Same-origin /api requests
          │
          ▼
      Hono Worker
          ├── Session authentication / ownership authorization
          ├── Zod request validation / security middleware
          ├── Web Crypto (PBKDF2, SHA-256, HMAC)
          └── Cloudflare D1 binding
                  └── users, sessions, projects, tasks, milestones, activity, auth_rate_limits
```

A single Worker serves the frontend and API. D1 is SQLite-compatible but accessed asynchronously through the Workers binding; the production Worker does not use Node's `node:sqlite` or a local filesystem. The local development server retains a Node/SQLite adapter so offline development and the existing API tests remain fast.

## Data model

- `users`: account identity and PBKDF2 password hash.
- `sessions`: SHA-256 hash of a random session token, owner and expiry.
- `projects`: user-owned project metadata and optional public share token.
- `tasks`: private work items and their status/priority.
- `milestones`: client-safe delivery checkpoints.
- `activity`: private project event history.
- `auth_rate_limits`: HMAC-SHA256 keyed attempt counters; raw IP/email identifiers are not stored.

Foreign keys cascade project-owned records when a project is deleted. User-owned project queries always include the authenticated user ID.

## Authentication flow

1. Registration validates input and derives a PBKDF2-SHA256 password hash using a random 128-bit salt and 310,000 iterations through Web Crypto.
2. Login verifies the stored hash using Web Crypto and a constant-time byte comparison.
3. A cryptographically random 256-bit session token is generated; only its SHA-256 hash is stored.
4. The raw token is set in an HttpOnly, Secure, SameSite=Lax cookie.
5. Authenticated middleware validates the session and expiry on private routes.
6. Logout deletes the server-side session and expires the cookie.

The Node-only local development adapter retains the earlier scrypt format. Production D1 accounts use PBKDF2; no existing production accounts or user data were migrated as part of the hosting move.

## Client sharing boundary

A project owner can enable or revoke a random share token. The public endpoint returns a deliberately restricted projection: project summary, milestone titles/status/dates and aggregate task counts. It does not return task titles, task descriptions, activity messages, user email or internal identifiers beyond the project ID.

## Runtime and delivery

- React 19, TypeScript, Vite 8
- Hono 4 on Cloudflare Workers
- Cloudflare Workers Static Assets for the frontend
- Cloudflare D1 for persistent SQL data
- Wrangler migrations in `migrations/`
- GitHub Actions CI and Cloudflare deployment workflow

The local-only Node server uses `node:sqlite`; it is not the production runtime. `wrangler.jsonc` is the production deployment contract.
