# CareerLinkAI

CareerLinkAI is a senior-high school career guidance platform grounded in the **RIASEC** (Holland) and **SCCT** (Social Cognitive Career Theory) frameworks. It combines psychometric assessment, an ML-backed recommendation engine, and an AI counselor to help students identify aligned SHS strands, college courses, and career paths — while giving school counselors a dashboard to manage departments, seminars, and student progress.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Features](#features)
  - [Student Portal](#student-portal)
  - [Counselor Portal](#counselor-portal)
  - [AI Counselor](#ai-counselor)
  - [Authentication and Email](#authentication-and-email)
  - [Real-time Notifications](#real-time-notifications)
- [Assessment Engine](#assessment-engine)
- [Scoring and Recommendation Engine](#scoring-and-recommendation-engine)
- [ML Predictor](#ml-predictor)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Cloudflare Configuration](#cloudflare-configuration)
- [Local Development](#local-development)
- [Commands](#commands)
- [Deployment](#deployment)
- [Environment Variables and Secrets](#environment-variables-and-secrets)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

CareerLinkAI is a monorepo containing:

| Package | Description |
|---|---|
| `apps/frontend` | React + Vite + TypeScript SPA — student and counselor portal |
| `apps/worker` | Hono API on Cloudflare Workers — REST, AI, real-time notifications |
| `apps/predictor` | Python prototype artifacts (offline research, not deployed) |

The frontend is built as a static bundle and served as Worker Assets, so the single Cloudflare Worker serves both the API and the UI.

**Live production URL:** `https://careerlinkai.online`
**Worker API URL:** `https://careerlinkai.cejascarldindo.workers.dev`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 4, TypeScript, TailwindCSS, React Router v6 |
| Backend | Cloudflare Workers, Hono v4, TypeScript |
| Database | Cloudflare D1 (SQLite-compatible, serverless) |
| Rate limiting | Cloudflare KV |
| Real-time | Cloudflare Durable Objects + WebSocket |
| AI / RAG | Cloudflare Workers AI (LLaMA), Vectorize (cosine similarity) |
| AI Gateway | Cloudflare AI Gateway (request logging + caching) |
| Email | Resend API (transactional email — verification, password reset) |
| CI/CD | GitHub Actions (ubuntu-latest) + Wrangler Action |

---

## Repository Structure

```
webappcareerlinkai-beta/
├── apps/
│   ├── frontend/
│   │   └── src/
│   │       ├── components/      # Shared UI — Logo, TopNav, Charts, Stepper
│   │       ├── data/            # Static data — riasec.ts, scct.ts, strands.ts, schools.ts
│   │       ├── lib/             # API client (api.ts), auth context (auth.tsx), toast, joinCode
│   │       └── pages/           # All route pages (see Routes below)
│   ├── worker/
│   │   ├── src/
│   │   │   ├── index.ts         # Hono app — all routes wired here
│   │   │   ├── auth.ts          # JWT sign/verify, password hashing, token generation
│   │   │   ├── scoring.ts       # RIASEC scoring, Holland code, recommendation engine
│   │   │   ├── ml/
│   │   │   │   ├── predictor.ts     # In-Worker ML inference (kNN-based)
│   │   │   │   └── predictorMap.ts  # Base64-encoded model data
│   │   │   ├── ai.ts            # Vectorize retrieval + LLaMA chat
│   │   │   ├── knowledge.ts     # RAG knowledge seeding (SCCT concepts)
│   │   │   ├── studentContext.ts # Builds per-student prompt context
│   │   │   ├── email.ts         # Resend email sender + HTML templates
│   │   │   ├── rateLimit.ts     # KV-backed token bucket rate limiter
│   │   │   └── careerLookup.ts  # Career data helpers
│   │   ├── schema.sql           # D1 schema (safe to re-run — IF NOT EXISTS)
│   │   ├── wrangler.toml        # Cloudflare Worker config
│   │   └── migrations/          # Incremental D1 migrations
│   └── predictor/               # Python prototype (offline research only)
├── .github/
│   └── workflows/
│       └── deploy-worker.yml    # CI: test → build frontend → deploy Worker
├── CLAUDE.md                    # AI assistant operating guide
└── README.md
```

---

## Features

### Student Portal

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Public marketing page with how-it-works, research, and counselor sections |
| `/signup` | Sign Up | Account creation (name, email, password, role) |
| `/signin` | Sign In | Email + password login |
| `/verify-email` | Email Verification | Token-based email confirmation |
| `/check-your-email` | Check Email | Post-signup nudge to verify inbox |
| `/forgot-password` | Forgot Password | Sends password reset link |
| `/reset-password` | Reset Password | Token-gated password change |
| `/onboarding` | Onboarding | Post-signup guided onboarding flow |
| `/profile/basics` | Profile Basics | School, grade level, strand, GWA, subject grades, guardian info |
| `/start-evaluation` | Start Evaluation | Intro page before assessments |
| `/assessment/riasec` | RIASEC Assessment | 48-question Likert assessment |
| `/assessment/scct` | SCCT Assessment | 12-question Likert assessment |
| `/portal/student/dashboard` | Student Dashboard | Results summary, course/career matches, seminar invitations |
| `/portal/student/result` | Student Results | Full RIASEC radar, SCCT scores, top courses and careers with match % |
| `/portal/student/departments` | Departments | Joined departments, pending invitations |
| `/portal/student/activity` | Activity | Student-scoped activity feed |
| `/portal/student/ai-counselor` | AI Counselor | Persistent AI chat sessions with context-aware career guidance |
| `/portal/student/settings` | Settings | Account info, password change, AI external consent |
| `/join/:code` | Join Department | Join a department via 6-character code |

### Counselor Portal

| Route | Page | Description |
|---|---|---|
| `/portal/counselor` | Counselor Dashboard | Overview stats, student roster, recent activity |
| `/portal/counselor/departments` | Departments | Create/manage departments, generate join codes |
| `/portal/counselor/departments/:id` | Department Detail | Members list, seminars, invitations for a specific department |
| `/portal/counselor/analytics` | Analytics | Heatmaps and bar charts for strand/Holland code distribution across students |
| `/portal/counselor/activity` | Activity / Events | Seminar management — create, schedule, invite students |
| `/portal/counselor/students/:id` | Student Detail | View a specific student's full assessment results and profile |
| `/portal/counselor/settings` | Counselor Settings | Profile management, school/contact info |

### AI Counselor

- **RAG (Retrieval-Augmented Generation):** Knowledge base seeded into Cloudflare Vectorize with SCCT concepts (self-efficacy, outcome expectations, perceived barriers). Retrieved via cosine similarity on LLaMA 3 embeddings.
- **Context-aware:** Each request builds a structured `StudentContext` — strand, GWA, Holland code, top courses/careers, SCCT scores — injected into the system prompt so the AI always knows who it's talking to.
- **Persistent sessions:** Chat history is stored per session in `ai_chat_sessions` and `ai_chat_messages`. Students can create multiple named sessions.
- **Model:** `@cf/meta/llama-3.1-8b-instruct` via Cloudflare Workers AI, routed through AI Gateway for observability.
- **Consent gate:** AI external processing requires explicit student consent (`ai_external_consent`), stored on the profile.

### Authentication and Email

- **JWT access tokens** (short-lived) + **opaque refresh tokens** (7-day, stored hashed in D1).
- **Email verification** — required before accessing the portal. Token is hashed (SHA-256) before storage; plain token is emailed via Resend.
- **Password reset** — time-limited (1-hour) hashed token, single-use.
- **Strong password** policy enforced server-side: ≥8 chars, uppercase, lowercase, digit, special character.
- **Email provider:** Resend API (`https://api.resend.com/emails`) — raw `fetch`, no SDK dependency.
- **From address:** `noreply@careerlinkai.online`

### Real-time Notifications

- Each user has a dedicated **Durable Object** (`NotificationDO`) keyed by user ID.
- Students connect via WebSocket at `/ws/notifications`.
- When the Worker writes a notification to D1 (e.g., seminar invite, join approval), it pushes the payload to the user's DO.
- The DO fans the message to all live WebSocket connections for that user.
- REST fallback: `GET /notifications` returns unread notifications; `POST /notifications/read-all` marks all read.

---

## Assessment Engine

### RIASEC (Holland Codes)

- **48 questions** — 8 per dimension, in order: **R**ealistic, **I**nvestigative, **A**rtistic, **S**ocial, **E**nterprising, **C**onventional.
- Each answer is a Likert scale 1–5 (Strongly Disagree → Strongly Agree).
- Score per dimension = average of 8 answers.
- **Holland Code** = top 3 dimensions by score, concatenated (e.g. `ISA`).

### SCCT (Social Cognitive Career Theory)

- **12 questions** — 3 subscales of 4 questions each:
  - Questions 1–4: **Self-Efficacy** — confidence in career-related tasks
  - Questions 5–8: **Outcome Expectations** — belief that effort leads to good outcomes
  - Questions 9–12: **Perceived Barriers** — obstacles that may limit career pursuit
- Score per subscale = average of 4 answers.

Both assessments use the same 1–5 Likert response scale. Answers are saved per question in `riasec_answers` and `scct_answers` and can be updated before final submission.

---

## Scoring and Recommendation Engine

`apps/worker/src/scoring.ts`

**Course and career catalog** — 10 courses and 10 careers, each with a RIASEC dimension weight profile (maximum 5 per dimension).

**Match score** = weighted dot product of student RIASEC scores against the item profile, normalised to 0–100.

**Strand boost** — additional points applied if the student's SHS strand aligns with the item:

| Strand | Boosted dimensions |
|---|---|
| STEM | I, R (+2) |
| ABM | E, C (+2) |
| HUMSS | S, A (+2) |
| ARTS | A (+3) |
| TVL | R (+2) |

Top 6 courses and top 6 careers are returned, capped at 99% match.

**Course catalog** (current): BS Computer Science, BS Architecture, BS Industrial Design, BS Psychology, BS Business Administration, BS Accountancy, BS Nursing, BS Mechanical Engineering, BS Multimedia Arts, AB Political Science.

**Career catalog** (current): Software Engineer, UX/Product Designer, Architect, Clinical Psychologist, Entrepreneur/Founder, Data Analyst, Teacher/Educator, Mechanical Engineer, Marketing Manager, Accountant/Auditor.

---

## ML Predictor

`apps/worker/src/ml/predictor.ts`

An in-Worker kNN-inspired predictor using a pre-encoded model baked into `predictorMap.ts` as Base64 binary arrays. No external API call — purely in-process inference.

**Inputs:**
- SHS strand (encoded as integer index)
- Subject grades: Math, English, Science for grades 7–10 (Likert-clamped)
- RIASEC scores per dimension
- SCCT subscale scores (self-efficacy, outcome expectations, perceived barriers)

**Outputs:**
- Best predicted career, best course, best subject area
- Predicted Holland code
- Predicted SHS strand
- SCCT summary
- Ranked course and career lists with match % and rationale

The predictor merges with the scoring engine output and is surfaced alongside the rule-based recommendations.

---

## Data Model

`apps/worker/schema.sql`

| Table | Purpose |
|---|---|
| `users` | All accounts — email, name, role (`student`/`counselor`), password hash + salt, `email_verified`, `onboarded` |
| `profiles` | Student profile — strand, GWA, grades JSON, school, grade level, gender, birthdate, contact, guardian, `basics_completed`, AI consent |
| `riasec_answers` | Per-question RIASEC responses (1–5), keyed `(user_id, question_id)` |
| `scct_answers` | Per-question SCCT responses (1–5), keyed `(user_id, question_id)` |
| `results` | Final computed results — Holland code, RIASEC JSON, SCCT JSON, courses JSON, careers JSON |
| `departments` | Counselor-owned groups — name, strand, unique 6-char join code |
| `department_members` | Student ↔ department membership |
| `seminars` | Events attached to a department — title, description, venue, scheduled time |
| `seminar_invites` | Per-student invite with status `pending`/`accepted`/`declined` |
| `activity` | Counselor activity feed entries |
| `schools` | Active school list (seeded: Calape National High School) |
| `password_reset_tokens` | Hashed, time-limited reset tokens |
| `email_verification_tokens` | Hashed, time-limited verification tokens |
| `refresh_tokens` | Hashed opaque refresh tokens (7-day) |
| `notifications` | Persistent notification records per user |
| `ai_chat_sessions` | AI chat session metadata per student |
| `ai_chat_messages` | Chat message history per session (`user`/`assistant`) |
| `system_config` | Key-value store for runtime flags (e.g. `vectorize_seeded`) |

Runtime tables (`notifications`, `ai_chat_*`, `refresh_tokens`, `system_config`) are created lazily by `ensureXSchema()` helpers in the Worker on first use.

---

## API Reference

All routes are defined in `apps/worker/src/index.ts`.

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check — returns `{ ok: true, ts }` |

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | — | Register (name, email, password, role) |
| POST | `/auth/signin` | — | Sign in; returns `accessToken` + `refreshToken` |
| POST | `/auth/refresh` | Refresh token | Issue new access + refresh token pair |
| POST | `/auth/signout` | Bearer | Revoke refresh token |
| GET | `/auth/me` | Bearer | Current user info |
| POST | `/auth/verify-email` | — | Verify email with token from link |
| POST | `/auth/resend-verification` | — | Resend verification email |
| POST | `/auth/forgot-password` | — | Send password reset email |
| POST | `/auth/reset-password` | — | Reset password with token |

### Profile and Assessments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile` | Bearer | Get own profile + results |
| POST | `/profile/basics` | Bearer (student) | Save profile basics (school, grade, grades, etc.) |
| GET | `/assessment/riasec` | Bearer (student) | Get saved RIASEC answers |
| POST | `/assessment/riasec` | Bearer (student) | Save RIASEC answers (batch upsert) |
| GET | `/assessment/scct` | Bearer (student) | Get saved SCCT answers |
| POST | `/assessment/scct` | Bearer (student) | Save SCCT answers (batch upsert) |
| POST | `/results` | Bearer (student) | Compute and store final results |
| GET | `/results` | Bearer (student) | Get own results |

### AI Counselor

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/ai/explain` | Bearer (student) | One-shot AI explanation of results |
| GET | `/ai/sessions` | Bearer (student) | List chat sessions |
| POST | `/ai/sessions` | Bearer (student) | Create new chat session |
| GET | `/ai/sessions/:id/chat` | Bearer (student) | Get messages in session |
| POST | `/ai/sessions/:id/chat` | Bearer (student) | Send message to AI, get response |
| POST | `/admin/seed-knowledge` | Bearer | Manually trigger Vectorize seeding |

### Counselor

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/counselor/departments` | Bearer (counselor) | List own departments |
| POST | `/counselor/departments` | Bearer (counselor) | Create department |
| GET | `/counselor/departments/:id` | Bearer (counselor) | Get department details + members |
| DELETE | `/counselor/departments/:id` | Bearer (counselor) | Delete department |
| GET | `/counselor/departments/:id/seminars` | Bearer (counselor) | List seminars in department |
| POST | `/counselor/departments/:id/seminars` | Bearer (counselor) | Create seminar and invite all members |
| GET | `/counselor/seminars` | Bearer (counselor) | All seminars across all departments |
| GET | `/counselor/stats` | Bearer (counselor) | Aggregate stats (student counts, strand distribution) |
| GET | `/counselor/activity` | Bearer (counselor) | Activity feed |
| GET | `/counselor/students/:id/results` | Bearer (counselor) | View a student's results |
| POST | `/counselor/ai/events` | Bearer (counselor) | AI-generate seminar suggestions |

### Student Collaboration

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/join/:code` | Bearer (student) | Join department by join code |
| GET | `/student/departments` | Bearer (student) | List joined departments |
| GET | `/student/invitations` | Bearer (student) | List seminar invitations |
| POST | `/student/invitations/:id/respond` | Bearer (student) | Accept or decline seminar invitation |

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/ws/notifications` | Bearer (WS upgrade) | WebSocket — real-time notification stream |
| GET | `/notifications` | Bearer | Fetch unread notifications |
| POST | `/notifications/read-all` | Bearer | Mark all notifications as read |

### Schools

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/schools` | — | List active schools |

---

## Cloudflare Configuration

`apps/worker/wrangler.toml`

| Binding | Type | Name/ID | Purpose |
|---|---|---|---|
| `DB` | D1 database | `webappcareerlinkai-beta` | Primary SQL store |
| `RATE_LIMITS` | KV namespace | `2bc63fefc13b4b70841b9e3c69f93faa` | Rate limit counters |
| `NOTIFICATIONS` | Durable Object | `NotificationDO` | Per-user WebSocket notification hub |
| `AI` | Workers AI | — | LLaMA inference + embeddings |
| `KNOWLEDGE` | Vectorize | `careerlinkai-knowledge` (768-dim, cosine) | RAG knowledge base |
| `ASSETS` | Static assets | `../frontend/dist` | Serves the built frontend SPA |

**Cron trigger:** `0 2 * * *` — daily at 02:00 UTC for scheduled maintenance tasks.

**Compatibility:** `nodejs_compat` flag enabled (for Node.js crypto APIs in the Worker).

---

## Local Development

### Prerequisites

- Node.js 20+
- npm
- Cloudflare account with Wrangler access (`npx wrangler login`)

### Setup

```bash
# 1. Install all dependencies
npm run install:all

# 2. (Optional) Point frontend to local Worker
echo "VITE_API_BASE=http://localhost:8787" > apps/frontend/.env

# 3. Authenticate Wrangler
npx wrangler whoami

# 4. Initialize remote D1 schema
npm run db:init
```

### Running locally

**Terminal A — Worker:**
```bash
npm run dev:worker
# Runs: wrangler dev --remote (uses remote D1 and KV)
```

**Terminal B — Frontend:**
```bash
npm run dev:frontend
# Runs: vite dev on http://localhost:5173
```

> **Note:** Worker dev uses `--remote` mode. All D1, KV, Vectorize, and Durable Object calls hit Cloudflare's infrastructure. Ensure Wrangler is authenticated and the remote D1 schema is initialised.

---

## Commands

Run from the repository root:

| Command | Description |
|---|---|
| `npm run install:all` | Install frontend + worker dependencies |
| `npm run dev:frontend` | Start Vite dev server (frontend only) |
| `npm run dev:worker` | Start Worker dev server (`wrangler dev --remote`) |
| `npm run build` | Build frontend production bundle to `apps/frontend/dist` |
| `npm run deploy:worker` | Build frontend then deploy Worker + assets via Wrangler |
| `npm run db:init` | Apply `schema.sql` to remote D1 (idempotent) |
| `npm run db:init:remote` | Same as `db:init` |

---

## Deployment

### Recommended: GitHub Actions (CI/CD)

`.github/workflows/deploy-worker.yml` triggers on pushes to `master` that touch frontend, worker, or workflow files.

**Pipeline steps:**
1. Checkout on `ubuntu-latest`
2. Install frontend and worker dependencies
3. Run worker tests (`npm test` in `apps/worker`)
4. Build frontend (`npm run build`)
5. Deploy Worker + assets via `cloudflare/wrangler-action`

### Manual deployment

```bash
npm run build
npm run deploy:worker
```

---

## Environment Variables and Secrets

### GitHub Actions secrets (repository-level)

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier |

### Cloudflare Worker secrets (`wrangler secret put <NAME>`)

| Secret | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Long random string for JWT signing |
| `FRONTEND_ORIGIN` | Yes | Allowed CORS origin (e.g. `https://careerlinkai.online`) |
| `RESEND_API_KEY` | Yes | Resend transactional email API key |
| `RESEND_FROM_EMAIL` | No | Sender address (default: `noreply@careerlinkai.online`) |
| `RESEND_FROM_NAME` | No | Sender display name (default: `CareerLinkAI`) |

### Frontend environment (`.env` in `apps/frontend/`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE` | `https://careerlinkai.cejascarldindo.workers.dev` | Worker API base URL |

---

## Troubleshooting

### `wrangler` command not found

Wrangler is not globally installed. Use `npx wrangler <command>` instead.

### Frontend build fails on Windows with native module error

Vite 4 is pinned to avoid Windows App Control blocking native Rollup binaries. Do not upgrade Vite locally. Run production builds in Linux CI.

### Worker deploy fails: assets directory missing

The frontend must be built before deploying:
```bash
npm run build
npm run deploy:worker
```

### Email not sending locally

`RESEND_API_KEY` is not set in `wrangler.toml` vars for local dev. Set it as a secret with `wrangler secret put RESEND_API_KEY` or the email send will be skipped with a console warning.

### Vectorize RAG returns empty results

The knowledge base is seeded automatically on first request after deploy. If it does not auto-seed, call `POST /admin/seed-knowledge` with a valid Bearer token to trigger it manually.

### Rate limit 429 on auth endpoints

Auth endpoints (signup, signin, forgot-password) are rate-limited per IP using Cloudflare KV. Wait for the window to reset (the response includes `retryAfter` in seconds).
