# CareerLinkAI Design Specification

## 1. Design Overview

CareerLinkAI is a cloud-native, role-based web platform for senior-high career guidance. The design combines:

1. A React frontend for student/counselor workflows.
2. A Cloudflare Worker API for business logic and orchestration.
3. D1 (SQLite) for transactional data.
4. Durable Objects for real-time notification fan-out.
5. Workers AI + Vectorize for AI-assisted guidance using retrieval-augmented generation (RAG).

Primary design goals:

1. Keep student and counselor workflows clearly separated but interoperable.
2. Ensure secure and reliable handling of identity, assessments, and recommendations.
3. Support near real-time collaboration signals (event invitations/responses).
4. Keep deployment simple using a single Worker serving both API and frontend assets.

## 2. System Context

### 2.1 External Interfaces

| External Service | Purpose |
|---|---|
| Cloudflare Workers Runtime | API execution and static asset hosting |
| Cloudflare D1 | Relational persistence |
| Cloudflare KV | Rate limit state buckets |
| Cloudflare Durable Objects | WebSocket session hub for notifications |
| Cloudflare Vectorize | Knowledge vector storage and retrieval |
| Cloudflare Workers AI | Embedding + LLM inference |
| Resend API | Transactional email for verification/reset |
| GitHub Actions | CI build/test/deploy automation |

### 2.2 Actor Interactions

1. **Student**: sign up with invitation, complete profile and assessments, view recommendations, chat with AI, respond to events.
2. **Counselor**: create departments and events, monitor student progress/results, view analytics, use AI draft assistant.
3. **Operator**: deploy Worker, manage secrets/bindings, monitor runtime.

## 3. Architecture

### 3.1 Logical Architecture

```text
Browser (React SPA)
  -> API client (JWT bearer)
  -> Cloudflare Worker (Hono routes + middleware)
      -> D1 (users, profiles, assessments, results, departments, events, notifications, chat)
      -> KV (rate limiting)
      -> Durable Object (notification WebSocket hub)
      -> Workers AI + Vectorize (AI explain/chat + event drafting)
      -> Resend API (email verification/reset)
```

### 3.2 Deployment Architecture

1. Frontend bundle is produced by Vite (`apps/frontend/dist`).
2. Worker deploy includes API code and asset binding (`ASSETS`) to frontend dist.
3. Same Worker handles API routes and SPA fallback routing.
4. CI workflow runs on Linux, executes tests/build, then deploys via Wrangler Action.

## 4. Frontend Design

### 4.1 Application Structure

| Area | Design |
|---|---|
| Routing | React Router route map split by public/student/counselor paths |
| Auth state | Context provider (`auth.tsx`) with token storage and user refresh |
| API access | Centralized `api.ts` wrapper with `Authorization` header injection |
| Role guard | `Protected` route wrapper checks session and role |
| Navigation | Role-specific portal nav model (`portalNav.ts`) |

### 4.2 Routing Strategy

1. Public routes: landing, sign-in/sign-up, password reset, email verification pages.
2. Student protected routes: profile basics, onboarding, RIASEC/SCCT, dashboard/results/departments/activity/AI/settings.
3. Counselor protected routes: dashboard, departments, events/activity, analytics, student detail, settings.
4. Unknown routes redirect to home on frontend.

### 4.3 Client State and Session

1. JWT token persisted in `localStorage`.
2. Session hydration via `/auth/me` on app load when token exists.
3. Logout clears token and in-memory user state.
4. API base uses environment override, otherwise dev/prod defaults.

## 5. Backend Design (Worker API)

### 5.1 API Framework and Middleware

| Concern | Design Choice |
|---|---|
| HTTP framework | Hono app as single route composition root |
| CORS | Origin restricted to configured frontend origin (or local dev fallback) |
| Authentication | Bearer JWT middleware (`auth`) |
| Authorization | Role guard middleware (`requireRole`) |
| Error handling | Central `onError` returns standardized server error JSON |
| Not found | API routes return 404 JSON; non-API GET/HEAD fallback to SPA assets |

### 5.2 Endpoint Groups

| Group | Key Endpoints |
|---|---|
| Health | `/health` |
| Auth | `/auth/signup`, `/auth/signin`, `/auth/password`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/me` |
| Student profile/assessment | `/profile`, `/profile/basics`, `/assessment/riasec`, `/assessment/scct`, `/results` |
| AI | `/ai/explain`, `/ai/sessions*`, `/admin/seed-knowledge`, `/counselor/events/ai-draft` |
| Counselor | `/counselor/departments*`, `/counselor/seminars*`, `/counselor/stats`, `/counselor/activity`, `/counselor/students/:id/results`, `/counselor/profile` |
| Student collaboration | `/join/:code`, `/student/departments`, `/student/invitations*` |
| Notification | `/ws/notifications`, `/notifications`, `/notifications/read-all` |

### 5.3 Schema-Guard Pattern

The Worker includes runtime `ensure*Schema` functions for selected tables/columns (`profiles`, `seminars`, `notifications`, `ai_chat_*`, auth token tables). This avoids runtime failures across partially migrated deployments and supports idempotent schema evolution.

## 6. Data Design

### 6.1 Core Entities

| Entity | Purpose |
|---|---|
| `users` | Identity, role, password hash/salt, onboarding and verification flags |
| `profiles` | Student/counselor profile details and student academic context |
| `riasec_answers` / `scct_answers` | Per-item assessment responses |
| `results` | Computed recommendations and score payloads |
| `departments` / `department_members` | Counselor-managed student groups and membership |
| `seminars` / `seminar_invites` | Event definitions and per-student invitation state |
| `activity` | Counselor-facing activity log stream |
| `notifications` | Persistent notification records with read state |
| `password_reset_tokens` / `email_verification_tokens` | One-time auth flow tokens (hash only) |
| `ai_chat_sessions` / `ai_chat_messages` | Persistent AI conversation threads |
| `system_config` | Operational flags (e.g., vectorize seeded state) |

### 6.2 Relationship Summary

1. One user can have one profile (`users` 1:1 `profiles`).
2. One counselor can own many departments.
3. Departments and students are many-to-many via `department_members`.
4. A student has many assessment answers and up to one current result record.
5. A seminar belongs to one department and has many invite records.
6. Notifications belong to one user and can be pushed in real-time.
7. AI chat sessions belong to one student and contain ordered chat messages.

## 7. Core Workflow Designs

### 7.1 Student Onboarding and Assessment

1. Student signs up with invitation code.
2. System validates code and enrolls student in department.
3. Student verifies email before sign-in access.
4. Student submits profile basics and onboarding grades/strand.
5. Student answers RIASEC and SCCT items (autosave).
6. Final submit validates completeness and computes results.
7. Results persisted and surfaced in dashboard/results pages.

### 7.2 Invitation Code and Department Join

1. Counselor creates department.
2. System generates unique 6-character join code.
3. Student signs up with code or joins later via `/join/:code`.
4. Membership insert is idempotent and activity is logged.
5. Student strand is set/locked from invitation-derived context where applicable.

### 7.3 Event Creation and Monitoring

1. Counselor creates seminar with title, schedule, optional venue/description.
2. System creates invitation records for all members.
3. Notification records are inserted for invited students.
4. Durable Object pushes real-time notification to connected clients.
5. Student accepts/declines invitation.
6. System logs response activity and notifies counselor.
7. Counselor monitors totals and student-level response lists.

### 7.4 AI Explain and Chat

1. Student asks explain/chat question.
2. System validates profile/result readiness and rate limits.
3. Student context is assembled from profile/results progress.
4. Query embedding retrieves top context docs from Vectorize.
5. LLM generates contextual reply through Workers AI.
6. If AI fails, system returns deterministic fallback response.
7. Chat mode persists user and assistant turns to D1.

## 8. Recommendation and Scoring Design

### 8.1 RIASEC/SCCT Computation

1. RIASEC: 48 answers grouped into 6 dimensions (8 each), scored by mean.
2. Holland code: top 3 dimensions sorted descending.
3. SCCT: 12 answers mapped into self-efficacy, outcome expectations, perceived barriers.

### 8.2 Dataset-Aligned Prediction

1. Predictor resolves best subject from grade structure.
2. Strand normalization maps equivalent labels to internal strand set.
3. Input index is built from subject, strand, Holland code, and SCCT bins.
4. Lookup resolves top course/career labels from precomputed map data.
5. Results include ranked `courses` and `careers` with match rationale.

## 9. AI and Knowledge Base Design

### 9.1 Knowledge Corpus

Corpus includes:

1. Platform/about knowledge.
2. SHS strand descriptions.
3. RIASEC and SCCT conceptual explanations.
4. Program/career labels from predictor map.
5. Optional source URL content chunks (manual seed request payload).

### 9.2 Vector and LLM Configuration

| Component | Current Design |
|---|---|
| Embeddings | `@cf/baai/bge-base-en-v1.5` |
| LLM | `@cf/meta/llama-3.1-8b-instruct` |
| Retrieval | Vectorize top-k similarity search with metadata |
| Observability | AI Gateway ID binding for AI call telemetry |

### 9.3 Seeding Strategy

1. Manual seeding via counselor-protected admin endpoint.
2. Automatic lazy seeding on AI usage when not seeded.
3. Scheduled daily reseed via Worker cron trigger.

## 10. Notification Design

### 10.1 Persistent and Realtime Layers

1. Persistent notifications stored in `notifications`.
2. Realtime delivery via Durable Object keyed by user ID.
3. WebSocket upgrade endpoint validates JWT and proxies to DO `/connect`.
4. Event-triggered notification creation calls DO `/push` for fan-out.

### 10.2 Read State

1. Unread count computed from `read = 0`.
2. `read-all` endpoint marks all current user's notifications as read.

## 11. Security Design

| Control | Implementation Detail |
|---|---|
| Password protection | PBKDF2-SHA256 + per-user salt + constant-time compare |
| Session auth | HS256 JWT with user ID subject and role claim |
| Role authorization | Route-level `requireRole` middleware |
| Tokenized flows | Opaque reset/verification token hashed via SHA-256 before storage |
| Abuse protection | KV-backed rate limiting for auth and AI endpoints |
| CORS | Configured origin allowlist with auth headers |
| Data safety | Prepared statements and parameter binding for D1 queries |

## 12. Performance and Reliability Design

1. Autosave-by-item reduces payload size and retry cost for assessments.
2. Idempotent inserts (`INSERT OR IGNORE`) reduce duplicate side effects.
3. Runtime schema guards reduce deployment breakage between versions.
4. API provides explicit validation errors early to avoid expensive downstream processing.
5. AI features include fallback responses to preserve UX continuity.

## 13. Deployment and Operations Design

### 13.1 CI/CD Flow

1. Trigger: push to `master` on frontend/worker/workflow path changes.
2. Install dependencies separately for frontend and worker.
3. Run worker tests.
4. Build frontend assets.
5. Deploy Worker using Cloudflare Wrangler Action.

### 13.2 Runtime Configuration

Main Wrangler bindings/vars:

1. `DB` (D1), `RATE_LIMITS` (KV), `NOTIFICATIONS` (DO), `KNOWLEDGE` (Vectorize), `AI`, `ASSETS`.
2. `JWT_SECRET`, `FRONTEND_ORIGIN`, `AI_GATEWAY_ID`, email sender vars.
3. Cron schedule for periodic knowledge seed.

## 14. Design Constraints and Tradeoffs

1. **Single-worker deployment** simplifies operations but centralizes many concerns in one service.
2. **Serverless runtime** enables scale-out but requires stateless request handling patterns.
3. **KV rate limit** is eventually consistent by design; acceptable for abuse mitigation, not strict quota accounting.
4. **RAG quality** depends on seeded knowledge quality and freshness.
5. **Invitation-code model** streamlines counselor-student affiliation but assumes code distribution process outside system.

## 15. Future Design Extensions

1. Department-level RBAC granularity (assistant counselor roles).
2. Audit logs and admin observability dashboards.
3. Enhanced analytics exports and cohort filters.
4. Feature flag framework in `system_config`.
5. Multi-tenant school partitioning and policy controls.
