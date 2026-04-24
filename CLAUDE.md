# CLAUDE.md

## Purpose

Use this file as the default operating guide when assisting in this repository.

Primary goal: deliver correct changes with the fewest tokens possible.

---

## Quick context pack

- Project: CareerLinkAI
- Monorepo with frontend + Cloudflare Worker backend
- Frontend is built and served as Worker assets
- Production deploy is expected to run on Linux CI

Repository roots:

- apps/frontend: React + Vite + TypeScript UI
- apps/worker: Hono API on Cloudflare Workers + D1 + Durable Object notifications
- apps/predictor: Python prototype artifacts
- .github/workflows/deploy-worker.yml: Linux CI deploy workflow

---

## Token-saving defaults

1. Do not scan the entire repo unless explicitly requested.
2. Start with targeted search, then read only needed files.
3. Prefer concise answers and diffs over long explanations.
4. Avoid repeating unchanged plans or context.
5. For implementation tasks, execute immediately after minimal context gathering.
6. Use one clear final summary: what changed, where, and how verified.
7. If blocked, state exact blocker and one practical next step.

---

## Fast task routing

Use this map before searching broadly.

### UI and page behavior

- Pages: apps/frontend/src/pages
- Shared components: apps/frontend/src/components
- Global styles: apps/frontend/src/index.css

### App data and dropdown options

- Static lists: apps/frontend/src/data
- School list: apps/frontend/src/data/schools.ts

### Frontend API calls and auth state

- API client: apps/frontend/src/lib/api.ts
- Auth context: apps/frontend/src/lib/auth.tsx

### Backend routes and business logic

- API entrypoint: apps/worker/src/index.ts
- Auth utilities: apps/worker/src/auth.ts
- Scoring: apps/worker/src/scoring.ts
- ML predictor: apps/worker/src/ml/predictor.ts

### Cloudflare config

- Worker config: apps/worker/wrangler.toml
- D1 schema: apps/worker/schema.sql
- Worker scripts: apps/worker/package.json

### CI and deployment

- Workflow: .github/workflows/deploy-worker.yml

---

## Known environment facts

1. Frontend uses Vite 4.x to avoid Windows policy issues with newer native Rollup binaries.
2. Production build/deploy should run in Linux CI to avoid local Windows App Control blocking.
3. Worker has D1 binding DB and Durable Object binding NOTIFICATIONS.
4. Frontend API base defaults to deployed Worker URL in production, localhost:8787 in dev.
5. School dropdown list currently contains only Calape National High School.

---

## Commands (preferred)

From repository root:

Install all:

- npm run install:all

Frontend dev:

- npm run dev:frontend

Worker dev:

- npm run dev:worker

Frontend production build:

- npm run build

Initialize remote D1 schema:

- npm run db:init

Deploy Worker with frontend assets:

- npm run deploy:worker

Wrangler auth check:

- npx wrangler whoami

---

## Deployment model

Preferred production path:

1. Push to master
2. GitHub Actions workflow runs on ubuntu-latest
3. CI builds frontend bundle
4. CI deploys Worker + assets via Wrangler Action

Required GitHub repository secrets:

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID

Required Worker secrets in Cloudflare:

- JWT_SECRET
- FRONTEND_ORIGIN
- OPENAI_API_KEY (optional)

---

## Editing policy

1. Make smallest change that solves the request.
2. Preserve existing naming, style, and file structure.
3. Do not refactor unrelated code.
4. Prefer updating existing source of truth instead of patching multiple call sites.
5. If data is shared (like schools.ts), change data once at source.

---

## Verification policy

After code edits, verify the narrowest relevant checks:

1. Build or type-check only affected package if possible.
2. For deploy tasks, include the deployed URL and status confirmation.
3. For UI data changes, verify the exact page imports the modified data source.

Do not run expensive full-suite checks unless requested.

---

## Troubleshooting quick answers

### wrangler command fails but npx wrangler works

Cause: wrangler is not globally installed or not on PATH.

Use:

- npx wrangler <command>

### Frontend build fails on Windows with native module blocked

Cause: host policy blocking native .node binary.

Fix:

1. Use Linux CI production builds
2. Keep local toolchain pinned to known-working versions

### Worker deploy fails saying assets directory missing

Cause: frontend dist not built.

Fix:

1. Run npm run build
2. Then run npm run deploy:worker

---

## Prompt templates (token-efficient)

Use these with Claude to reduce back-and-forth.

### Focused feature change

Implement <feature> in <file/path>. Keep minimal diff. Run only relevant checks. Report changed files and result.

### Fast bug fix

Find root cause of <issue>. Patch only required files. Provide one-paragraph cause and exact fix.

### Findings-first review

Review changes for bugs and regressions only. List findings by severity with file paths, then brief summary.

### Deploy request

Prepare and execute deploy steps for this repo. Include blockers, required secrets, and final live verification.

---

## Definition of done

A task is done only when all are true:

1. Requested change is implemented.
2. Relevant checks or run commands pass (or blocker documented).
3. Final response includes:
	- What changed
	- Which files changed
	- How it was verified
	- Any required next action