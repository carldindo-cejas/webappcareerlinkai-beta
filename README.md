# CareerLinkAI

Senior-high career guidance platform built on the RIASEC and Social Cognitive Career Theory (SCCT) frameworks, with a contextual AI counselor.

**Stack**

- Frontend: React 18 + Vite + TypeScript + TailwindCSS + React Router
- Backend: Cloudflare Workers (Hono) + D1 (SQLite) + JWT (`jose` HS256)
- Design: Editorial palette (forest / cream / terracotta), Fraunces + Geist fonts
- Fully responsive — layouts adapt from ~360px phones up to 1280px+ desktops.

## Repository layout

```
webappcareerlinkai_beta/
├── apps/
│   ├── frontend/      # React + Vite + Tailwind app
│   ├── predictor/     # Python predictor prototype assets
│   └── worker/        # Cloudflare Worker (Hono + D1 + JWT)
│       └── schema.sql # D1 schema
└── README.md
```

## Prerequisites

- Node.js 18+ (Node 20 recommended)
- A Cloudflare account if you plan to deploy (sign up free at cloudflare.com)
- `npx wrangler login` for the first deploy

## Install

```bash
npm run install:all
```

This installs dependencies in both `apps/frontend/` and `apps/worker/`.

## Local development (Cloudflare backend)

You need **two terminals**:

### 1. Worker + remote D1 (terminal A)

Initialize the remote D1 schema and deploy the worker:

```bash
cd apps/worker
npm run db:init
npm run deploy
```

### 2. Frontend (terminal B)

Create `apps/frontend/.env` with your worker URL:

```env
VITE_API_BASE=https://<your-worker-subdomain>.workers.dev
```

Then run the frontend:

```bash
cd apps/frontend
npm run dev
```

Open `http://localhost:5173` and the frontend will call your deployed Cloudflare Worker directly.

## Test flow

1. Go to `http://localhost:5173`, click **Get started**.
2. Create a **student** account (email + 8+ char password).
3. Complete the onboarding (strand + GWA + Math/English/Science grades for Grade 7 to 10).
4. Answer the 48-item RIASEC assessment (keys `1`–`5` and arrows work).
5. Answer the 12-item SCCT reflection.
6. Land on the results dashboard with your Holland code, radar chart, and ranked courses/careers.
7. In a second browser, sign up as a **counselor**, create a department, copy the join link/code, then create a seminar invitation for that department.

## Deploy to Cloudflare

### Worker + D1 (production)

```bash
cd apps/worker
npx wrangler d1 create careerlinkai            # one-time, if not done
# paste the database_id into wrangler.toml
npx wrangler d1 execute careerlinkai --remote --file=./schema.sql
npx wrangler secret put JWT_SECRET             # generate a long random string
npx wrangler secret put FRONTEND_ORIGIN        # e.g. https://careerlinkai.pages.dev
npx wrangler secret put OPENAI_API_KEY         # optional, enables external AI explanations
npm run deploy
```

### Frontend (Cloudflare Pages)

```bash
cd apps/frontend
npm run build
# Deploy dist/ to Cloudflare Pages, or use `npx wrangler pages deploy dist`
```

In production, change the frontend's API base from the Vite proxy to the deployed worker URL — the simplest way is a Pages function or a small `VITE_API_BASE` env var (add to `src/lib/api.ts` as `const base = import.meta.env.VITE_API_BASE || '/api'`).

## API surface

All endpoints are JSON. Authenticated routes require `Authorization: Bearer <jwt>`.

| Method   | Path                                  | Role      | Description                                  |
| -------- | ------------------------------------- | --------- | -------------------------------------------- |
| POST     | `/auth/signup`                        | public    | Create user, returns JWT                     |
| POST     | `/auth/signin`                        | public    | Sign in, returns JWT                         |
| GET      | `/auth/me`                            | any       | Current user                                 |
| GET/PUT  | `/profile`                            | student   | Onboarding data                              |
| GET/PUT  | `/profile/ai-consent`                 | student   | Manage consent for external AI usage         |
| GET/PUT  | `/assessment/riasec`                  | student   | RIASEC answers (autosaved)                   |
| POST     | `/assessment/riasec/submit`           | student   | Mark RIASEC complete                         |
| GET/PUT  | `/assessment/scct`                    | student   | SCCT answers (autosaved)                     |
| POST     | `/assessment/scct/submit`             | student   | Score and generate results                   |
| GET      | `/results`                            | student   | Holland code, RIASEC, SCCT, courses, careers |
| POST     | `/ai/explain`                         | student   | Context-aware explanation of recommendations |
| GET      | `/student/invitations`                | student   | List seminar/activity invitations            |
| POST     | `/student/invitations/:id/respond`    | student   | Accept or decline an invitation              |
| GET/POST | `/counselor/departments`              | counselor | List / create departments                    |
| GET      | `/counselor/departments/:id`          | counselor | Department detail + student roster           |
| POST     | `/counselor/departments/:id/seminars` | counselor | Create seminar and invite department         |
| GET      | `/counselor/students/:id/results`     | counselor | View full student profile and result detail  |
| GET      | `/counselor/activity`                 | counselor | Recent activity feed                         |
| POST     | `/join/:code`                         | student   | Join using 6-char invitation code            |

## Scoring method

- **RIASEC** — 48 items, 8 per dimension (R, I, A, S, E, C). Each dimension score is the mean of its 8 item values (1–5). The Holland code is the top 3 dimensions.
- **SCCT** — 12 items grouped as self-efficacy (1–4), outcome expectations (5–8), perceived barriers (9–12). Each score is a 1–5 mean.
- **Course / career match** — weighted dot product of the student's RIASEC scores against each item's canonical Holland profile, normalised to a readable percentage, with a small strand-fit boost.

## Security notes

- Passwords hashed with PBKDF2-SHA256 at 100 000 iterations using the Web Crypto API.
- JWTs signed HS256, 30-day expiry; secret stored as a Worker secret in production.
- CORS restricted to `FRONTEND_ORIGIN` in production.
- External AI calls require explicit student consent (`/profile/ai-consent`) before any request is sent.
- All D1 queries use parameter binding (prepared statements).
