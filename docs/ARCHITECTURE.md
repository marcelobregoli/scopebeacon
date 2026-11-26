# Architecture

## Overview

ScopeBeacon is a same-origin web application with a React single-page frontend and a Hono REST API. The API runs on Node.js and persists data in SQLite. In development, Vite serves the frontend and proxies `/api` requests to the API process. In production, the Node server serves the compiled frontend and API from one origin.

```text
Browser
  ├── React + TypeScript (Vite build)
  └── Same-origin /api requests
          │
          ▼
      Hono API
          ├── Session authentication
          ├── Ownership authorization
          ├── Zod request validation
          └── SQLite persistence
```

## Data model

- `users`: account identity and scrypt password hash.
- `sessions`: SHA-256 hash of a random session token, owner and expiry.
- `projects`: user-owned project metadata and optional public share token.
- `tasks`: private work items and their status/priority.
- `milestones`: client-safe delivery checkpoints.
- `activity`: private project event history.

Foreign keys cascade project-owned records when a project is deleted. User-owned project queries always include the authenticated user ID.

## Authentication flow

1. Registration validates the input and stores a salted scrypt password hash.
2. Login verifies the password using constant-time comparison.
3. A cryptographically random session token is generated; only its SHA-256 hash is stored in SQLite.
4. The raw token is set in an HttpOnly, SameSite=Lax cookie.
5. Authenticated middleware validates the session and expiry on private routes.
6. Logout deletes the server-side session and expires the cookie.

## Client sharing boundary

A project owner can enable or revoke a random share token. The public endpoint returns a deliberately restricted projection: project summary, milestone titles/status/dates and aggregate task counts. It does not return task titles, task descriptions, activity messages, user email or internal identifiers beyond the project ID.

## Runtime

- Node.js 26
- React 19, TypeScript 5, Vite 8
- Hono 4, `@hono/node-server`
- Node built-in `node:sqlite`

SQLite is suitable for a small self-hosted deployment with a persistent disk and regular backups. A horizontally scaled deployment should move persistence to a managed database and centralize session/rate-limit state.
