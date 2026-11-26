# API reference

All API routes are prefixed with `/api`. JSON request bodies are validated server-side. Private routes require the `scopebeacon_session` cookie.

## Health and authentication

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/auth/register` | Public | Create account and session |
| POST | `/auth/login` | Public | Sign in and create session |
| POST | `/auth/logout` | Session | Revoke current session |
| GET | `/auth/me` | Session | Return current user |

Registration requires a name, valid email and password of at least 10 characters.

## Projects

| Method | Route | Purpose |
|---|---|---|
| GET | `/projects` | List current user's projects with task/milestone counts |
| POST | `/projects` | Create a project |
| GET | `/projects/:id` | Read project, private tasks, milestones and activity |
| PATCH | `/projects/:id` | Update name, client, summary or status |
| DELETE | `/projects/:id` | Delete an owned project and its dependent records |

Project statuses: `active`, `on-hold`, `completed`.

## Tasks and milestones

| Method | Route | Purpose |
|---|---|---|
| POST | `/projects/:id/tasks` | Add a task |
| PATCH | `/projects/:id/tasks/:taskId` | Update title, status, priority or due date |
| POST | `/projects/:id/milestones` | Add a milestone |
| PATCH | `/projects/:id/milestones/:milestoneId` | Update title, status or due date |

Task statuses: `todo`, `in-progress`, `done`. Priorities: `low`, `normal`, `high`. Milestone statuses: `upcoming`, `in-progress`, `complete`.

## Public client view

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/projects/:id/share` | Session | Enable or revoke a public progress token |
| GET | `/public/:token` | Public | Return the restricted client-safe project projection |

The public response intentionally omits task records and activity history. Revoking sharing invalidates the token immediately.

## Error responses

Errors return JSON in the form `{ "error": "..." }` with standard HTTP status codes. `401` indicates a missing/expired session, `404` indicates a missing or non-owned resource, and `400` indicates invalid input.
