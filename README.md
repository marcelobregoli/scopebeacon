# ScopeBeacon

**Project delivery, clearly.**

**Live application:** https://scopebeacon.digitaligamesml.workers.dev

**Project case study:** https://marcelo-bregoli.pages.dev/projects/scopebeacon.html

ScopeBeacon is a full-stack project workspace for independent developers and small teams. Organize client work, track delivery and share progress without exposing internal task notes.

![ScopeBeacon sample workspace](docs/screenshots/demo-dashboard.png)

## Why ScopeBeacon

Client updates should not require another meeting, another account or access to your internal workspace. ScopeBeacon gives developers a private delivery workspace and clients a clean, read-only progress page.

## Features

- Email/password registration, login and logout
- Project dashboard with delivery metrics
- Project creation and status management
- Task creation and completion tracking
- Milestone creation and status progression
- Private project activity timeline
- Revocable client progress links
- Read-only client view with milestones and aggregate progress
- Responsive desktop and mobile interface
- Sample workspace at `/demo`

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8 |
| API | Hono 4 on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite-compatible SQL) |
| Validation | Zod |
| Authentication | PBKDF2-SHA256 password hashes, random server-side sessions, HttpOnly cookies |
| Tests | Vitest |
| CI/CD | GitHub Actions + Wrangler |
| Source of truth | GitHub (`marcelobregoli/scopebeacon`) |

## Run locally

Requirements: Node.js 26 and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

The local development API remains Node/Hono + SQLite for a fast offline workflow. It starts on port 8792; Vite proxies `/api` requests. The local database is created at `data/scopebeacon.sqlite`; the database and environment file are excluded from Git.

## Verify

```bash
npm test
npm run typecheck
npm run typecheck:worker
npm run build:web
npm audit --audit-level=high
```

## Cloudflare deployment

The hosted application uses one Cloudflare Worker for Hono API routes and React static assets, with a dedicated D1 database. Wrangler configuration and SQL migrations are version-controlled in this repository.

```bash
npx wrangler d1 migrations apply scopebeacon-production --remote
npx wrangler secret put RATE_LIMIT_SECRET
npm run build:web
npx wrangler deploy
```

For automatic deployment from GitHub Actions, add a repository Actions secret named `CLOUDFLARE_API_TOKEN` with a narrowly scoped token that can edit Workers and D1 in the intended Cloudflare account. Never commit API tokens or runtime secrets. The workflow applies D1 migrations and deploys the Worker on pushes to `main`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Security posture and production checklist](docs/SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Security and production readiness

The Worker uses PBKDF2-SHA256 with per-user random salts, hashed random session tokens, expiring server-side sessions, HttpOnly/SameSite cookies, server-side validation, per-user ownership checks, persistent HMAC-keyed authentication throttles, restrictive security headers and a deliberately restricted public client response. Password derivation uses Web Crypto APIs supported by Workers.

ScopeBeacon remains a portfolio MVP. Email verification/password reset, monitoring/abuse response, tested backups/restore, account export/deletion, privacy/retention review and independent production security review remain open. Do not enter real client data until those controls are completed and reviewed.

## Attribution

Original application and implementation by Marcelo Bregoli. Third-party dependencies retain their respective licenses. Licensed under MIT.
