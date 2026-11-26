# Contributing

1. Fork the repository and create a focused feature branch.
2. Install dependencies with `npm ci` using Node.js 26.
3. Run `npm test`, `npm run typecheck` and `npm run build` before opening a pull request.
4. Add or update API tests for behavior and authorization changes.
5. Never commit `.env`, database files, credentials, customer data or generated build output.
6. Keep public client responses privacy-safe; add tests whenever their schema changes.

Pull requests should explain the user problem, implementation, verification performed and any security or migration implications.
