# botwatch.xyz

Cybersecurity + AI-readiness + web-intelligence platform. Node/Express backend,
React (Vite) frontend, PostgreSQL. Prod runs via **PM2** (server.js) behind a
**Cloudflare tunnel** — no IIS. See the roadmap/status in agent memory.

## Stack & layout
- `backend/` — Express API. Public routes mounted **before** the `app.use('/api', requireAuth)` gate; admin routes after it. Startup runs idempotent migrations (`utilities/runMigrations.js`) — schema self-heals on boot.
- `frontend/` — React + Vite SPA, served statically by the backend from `frontend/dist`.
- Auth: JWT `auth_token` cookie. Roles: `admin`, `user`, `guest` (research) and `customer` (self-serve API accounts, separate `customer` table).

## Git workflow
- Branch off `origin/main`: `git checkout -b <type>/<slug> origin/main`.
- One feature per branch/PR. Commit, push, open a PR with `gh pr create`.
- **Do NOT merge.** Leave every PR open for the user to review and merge. (This is a deliberate standing choice.)
- End commit messages with the Co-Authored-By trailer; end PR bodies with the Generated-with trailer.

## Deploy (the USER does this, never the agent)
From the **`backend/` directory** (so `dotenv` finds `backend/.env`):
`git pull` → `cd ../frontend && npm run build` → `cd ../backend && pm2 restart botwatch --update-env`.
Migrations run automatically on boot. If a deploy "doesn't take," suspect a stale `.env`/cwd or an orphan node process holding the port (see agent memory).

## Verification (what "test" means here)
There is **no database in the agent's environment**, so the agent cannot run the app end-to-end. Verify with: `node --check`, `npm run build`, `oxlint`, unit-style logic simulations, and browser-render checks of frontend pages. **Integration + prod smoke-testing is the user's step after deploy.**

## Autonomous workflow (the loop)
When running `/loop`, each iteration handles ONE ticket from `BACKLOG.md` (top of the queue) through this cycle:

1. **Test** — establish the baseline builds/lints clean.
2. **Code** — implement the ticket on a fresh feature branch.
3. **Review** — run `/code-review` (use `/security-review` for auth, billing, tracking, or anything handling credentials/PII).
4. **Clean up** — run the `simplify` skill on the diff.
5. **Test again** — `node --check` new files, `npm run build`, plus a targeted logic simulation.
6. **Ship** — open a PR (do NOT merge). Mark the ticket done in `BACKLOG.md` and update memory.
7. **Report & roll on** — summarize what shipped + what needs the user (creds, decisions, deploy), then start the next ticket.

### Definition of done (per ticket)
Build + lint pass · new backend files pass `node --check` · logic verified by simulation or render · PR opened · `BACKLOG.md` + memory updated.

### Guardrails — STOP and ask the user (don't guess) when a ticket needs:
- A real **product/UX decision** with tradeoffs (like the billing model or the auth-tracking policy did).
- **External credentials or a third-party account** (email provider, API keys). Build an **inert scaffold** that no-ops until configured — mirroring the Stripe billing scaffolding — flag it, and continue to the next ticket rather than blocking.
- Anything **destructive/irreversible**, or a **deploy**. The agent never deploys.
Never merge PRs. Never commit real secrets. Keep changes scoped to one ticket.

See `BACKLOG.md` for the queue and agent memory for phase status.
