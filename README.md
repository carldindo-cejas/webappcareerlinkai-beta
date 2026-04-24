# CareerLinkAI

Senior-high career guidance platform built on the RIASEC and Social Cognitive Career Theory (SCCT) frameworks, with a Cloudflare-native AI counselor.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS + React Router
- **Backend:** Cloudflare Workers (Hono) + D1 (SQLite) + Durable Objects + JWT (jose HS256)
- **AI/Knowledge:** Cloudflare Workers AI (Llama 3.1 8B) + Vectorize (768-dim embeddings) + AI Gateway
- **Deployment:** Cloudflare Workers assets + GitHub Actions Linux CI

## Repository Layout

```text
webappcareerlinkai-beta/
├── apps/
│   ├── frontend/                     # React + Vite + TailwindCSS app
│   │   ├── src/
│   │   │   ├── pages/                # Student & counselor page routes
│   │   │   ├── components/           # Shared React components
│   │   │   ├── lib/                  # Auth, API client, routing config
│   │   │   ├── data/                 # Static data: strands, RIASEC, SCCT, schools
│   │   │   ├── App.tsx               # Main router
│   │   │   └── index.css             # Global TailwindCSS + theme
│   │   └── vite.config.ts            # Build config
│   ├── worker/                       # Cloudflare Worker + AI + Knowledge
│   │   ├── src/
│   │   │   ├── index.ts              # Main API routes & handlers
│   │   │   ├── auth.ts               # JWT signing, password hashing
│   │   │   ├── scoring.ts            # RIASEC & SCCT scoring logic
│   │   │   ├── ai.ts                 # Workers AI wrapper (embed, retrieve, LLM)
│   │   │   ├── knowledge.ts          # Knowledge corpus builder for Vectorize
│   │   │   ├── notificationDO.ts     # Durable Object for real-time notifications
│   │   │   └── ml/
│   │   │       ├── predictor.ts      # Course/career matching ML predictor
│   │   │       └── predictorMap.ts   # Course/career label metadata
│   │   ├── schema.sql                # D1 SQLite schema (profiles, assessments, etc.)
│   │   ├── wrangler.toml             # Cloudflare config: AI, Vectorize, D1, cron
│   │   └── package.json
│   └── predictor/                    # Python prototype assets (legacy)
├── .github/workflows/
│   └── deploy-worker.yml             # CI/CD: builds frontend, deploys worker
├── CLAUDE.md                         # Developer guide & token-saving tips
└── README.md (this file)
```

---

## Where to Find Each Feature

### Student Pages
- **Landing & Auth:** [`apps/frontend/src/pages/Landing.tsx`](apps/frontend/src/pages/Landing.tsx), [`SignIn.tsx`](apps/frontend/src/pages/SignIn.tsx)
- **Onboarding (profile basics):** [`Onboarding.tsx`](apps/frontend/src/pages/Onboarding.tsx), [`ProfileBasics.tsx`](apps/frontend/src/pages/ProfileBasics.tsx)
- **RIASEC assessment:** [`RiasecAssessment.tsx`](apps/frontend/src/pages/RiasecAssessment.tsx) → backend route `/assessment/riasec`
- **SCCT assessment:** [`ScctAssessment.tsx`](apps/frontend/src/pages/ScctAssessment.tsx) → backend route `/assessment/scct`
- **Results & recommendations:** [`StudentResults.tsx`](apps/frontend/src/pages/StudentResults.tsx) → backend route `/results`
- **Dashboard:** [`StudentDashboard.tsx`](apps/frontend/src/pages/StudentDashboard.tsx) (progress, chat preview)
- **AI Counselor (multi-turn chat):** [`StudentAICounselor.tsx`](apps/frontend/src/pages/StudentAICounselor.tsx) → backend routes `/ai/sessions`, `/ai/sessions/:id/chat`
- **Student activity feed:** [`StudentActivity.tsx`](apps/frontend/src/pages/StudentActivity.tsx) → backend route `/student/activity`
- **Settings:** [`StudentSettings.tsx`](apps/frontend/src/pages/StudentSettings.tsx) (password, profile)
- **Department enrollment:** [`StudentDepartments.tsx`](apps/frontend/src/pages/StudentDepartments.tsx), [`JoinDepartment.tsx`](apps/frontend/src/pages/JoinDepartment.tsx)

### Counselor Pages
- **Dashboard:** [`CounselorDashboard.tsx`](apps/frontend/src/pages/CounselorDashboard.tsx)
- **Departments:** [`CounselorDepartments.tsx`](apps/frontend/src/pages/CounselorDepartments.tsx) (create, list), [`DepartmentDetail.tsx`](apps/frontend/src/pages/DepartmentDetail.tsx) (roster, seminars)
- **Student detail:** [`CounselorStudentDetail.tsx`](apps/frontend/src/pages/CounselorStudentDetail.tsx) → backend route `/counselor/students/:id/results`
- **Activity feed:** [`CounselorActivity.tsx`](apps/frontend/src/pages/CounselorActivity.tsx) → backend route `/counselor/activity`
- **Settings:** [`CounselorSettings.tsx`](apps/frontend/src/pages/CounselorSettings.tsx) (profile, password)
- **Analytics (seminars, invitations):** [`CounselorAnalytics.tsx`](apps/frontend/src/pages/CounselorAnalytics.tsx)

### Data & Config
- **RIASEC items & labels:** [`apps/frontend/src/data/riasec.ts`](apps/frontend/src/data/riasec.ts) (48 items, 6 dimensions)
- **SCCT constructs:** [`apps/frontend/src/data/scct.ts`](apps/frontend/src/data/scct.ts) (12 items, 3 constructs)
- **Senior-high strands:** [`apps/frontend/src/data/strands.ts`](apps/frontend/src/data/strands.ts) (STEM, ABM, HUMSS, ICT, HE)
- **School list:** [`apps/frontend/src/data/schools.ts`](apps/frontend/src/data/schools.ts)

### Shared Components
- **Layout:** [`PortalLayout.tsx`](apps/frontend/src/components/PortalLayout.tsx) (sidebar nav, header)
- **Charts:** [`RadarChart.tsx`](apps/frontend/src/components/RadarChart.tsx) (RIASEC visualization), [`BarChart.tsx`](apps/frontend/src/components/charts/BarChart.tsx)
- **Navigation:** [`portalNav.ts`](apps/frontend/src/lib/portalNav.ts) (student/counselor menu items)
- **Notifications:** [`NotificationBell.tsx`](apps/frontend/src/components/NotificationBell.tsx), [`NotificationContext.tsx`](apps/frontend/src/lib/NotificationContext.tsx)

### Authentication & API
- **Auth context & hooks:** [`apps/frontend/src/lib/auth.tsx`](apps/frontend/src/lib/auth.tsx) (JWT storage, login state)
- **API client:** [`apps/frontend/src/lib/api.ts`](apps/frontend/src/lib/api.ts) (HTTP wrapper with auth headers)
- **Backend auth utilities:** [`apps/worker/src/auth.ts`](apps/worker/src/auth.ts) (JWT sign/verify, password hash)

### Scoring & Matching
- **RIASEC & SCCT scoring:** [`apps/worker/src/scoring.ts`](apps/worker/src/scoring.ts) (dimension averages, Holland code)
- **Course/career matching:** [`apps/worker/src/ml/predictor.ts`](apps/worker/src/ml/predictor.ts) (dot product matching)
- **Career metadata:** [`apps/worker/src/ml/predictorMap.ts`](apps/worker/src/ml/predictorMap.ts) (course/career labels, descriptions)

### AI & Knowledge Base
- **Workers AI wrapper:** [`apps/worker/src/ai.ts`](apps/worker/src/ai.ts)
  - `embed()` — embed text to 768-dim vector using baai/bge-base-en-v1.5
  - `embedBatch()` — batch embed for efficiency
  - `retrieveContext()` — retrieve top-4 relevant docs from Vectorize
  - `runLlama()` — call Llama 3.1 8B with AI Gateway logging
- **Knowledge corpus:** [`apps/worker/src/knowledge.ts`](apps/worker/src/knowledge.ts)
  - `buildKnowledgeCorpus()` — generates ~101 vectors from strands, RIASEC, SCCT, courses, careers
  - `seedKnowledge()` — batch embeds and upserts into Vectorize index
  - Add new knowledge by extending the arrays or appending docs

### API Routes
- **Main handler:** [`apps/worker/src/index.ts`](apps/worker/src/index.ts) (all routes defined here)
- **AI explain (one-off):** `POST /ai/explain` — explains a result or question
- **AI Counselor (multi-turn):** `POST /ai/sessions/:id/chat` — persisted chat with student context
- **Vectorize seeding:** `POST /admin/seed-knowledge` (counselor auth) — manually trigger knowledge embedding
- **Auto-seeding:** Runs automatically on first AI request + daily at 2 AM UTC via cron

### Database
- **Schema:** [`apps/worker/schema.sql`](apps/worker/schema.sql)
  - Users, profiles, assessments (riasec, scct), results
  - Departments, seminars, notifications, system_config
  - AI chat sessions & messages
- **Queries:** All in [`apps/worker/src/index.ts`](apps/worker/src/index.ts) routes (D1 prepared statements)

### Real-time Notifications
- **Durable Object:** [`apps/worker/src/notificationDO.ts`](apps/worker/src/notificationDO.ts) (WebSocket broadcasting)
- **Frontend listener:** [`NotificationContext.tsx`](apps/frontend/src/lib/NotificationContext.tsx)

---

## API Surface

All endpoints are JSON. Authenticated routes require `Authorization: Bearer <jwt>`.

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| **Auth** |||
| POST | `/auth/signup` | public | Create user, returns JWT |
| POST | `/auth/signin` | public | Sign in, returns JWT |
| POST | `/auth/password` | student/counselor | Change password |
| GET | `/auth/me` | any | Get current user (id, name, email, role) |
| **Student Profile** |||
| GET | `/profile` | student | Read profile (school, strand, grades, etc.) |
| PUT | `/profile` | student | Update profile |
| **Assessments** |||
| GET/PUT | `/assessment/riasec` | student | RIASEC answers (autosave per session) |
| POST | `/assessment/riasec/submit` | student | Mark RIASEC complete, generate Holland code |
| GET/PUT | `/assessment/scct` | student | SCCT answers (autosave per session) |
| POST | `/assessment/scct/submit` | student | Score SCCT, compute final results |
| **Results** |||
| GET | `/results` | student | Holland code, RIASEC, SCCT, courses, careers |
| **AI (Always Enabled)** |||
| POST | `/ai/explain` | student | One-off explanation of recommendations (uses RAG) |
| GET | `/ai/sessions` | student | List chat sessions |
| POST | `/ai/sessions` | student | Create new chat session |
| POST | `/ai/sessions/:id/chat` | student | Send message, get reply (uses RAG, persisted) |
| POST | `/admin/seed-knowledge` | counselor | Embed & upsert knowledge corpus to Vectorize |
| **Invitations & Activities** |||
| GET | `/student/invitations` | student | List seminar invitations |
| POST | `/student/invitations/:id/respond` | student | Accept/decline invitation |
| POST | `/join/:code` | student | Join department using 6-char code |
| GET | `/student/activity` | student | Personal activity feed |
| GET | `/counselor/activity` | counselor | Counselor-wide activity feed |
| **Counselor Departments** |||
| GET | `/counselor/departments` | counselor | List counselor's departments |
| POST | `/counselor/departments` | counselor | Create department (name, strand) |
| GET | `/counselor/departments/:id` | counselor | Dept detail + student roster |
| POST | `/counselor/departments/:id/seminars` | counselor | Create seminar & invite department |
| **Counselor Student View** |||
| GET | `/counselor/students/:id/results` | counselor | View student's full profile & results |

---

## Commands

### Install & Setup

```bash
# Install all dependencies (frontend + worker)
npm run install:all

# Initialize remote D1 database (one-time)
npm run db:init

# Check Wrangler authentication
npx wrangler whoami
```

### Development

```bash
# Terminal A: Worker (http://localhost:8787)
npm run dev:worker

# Terminal B: Frontend (http://localhost:5173, calls localhost:8787 API)
npm run dev:frontend
```

### Production Build & Deploy

```bash
# Build frontend production bundle
npm run build

# Deploy Worker + assets to Cloudflare
npm run deploy:worker
```

---

## Local Development

### Setup

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Verify Wrangler is authenticated:**
   ```bash
   npx wrangler whoami
   ```

3. **Create `.env` in `apps/frontend/`:**
   ```env
   VITE_API_BASE=http://localhost:8787
   ```

4. **Terminal A — Start Worker:**
   ```bash
   npm run dev:worker
   ```
   Runs on `http://localhost:8787` with D1 in memory.

5. **Terminal B — Start Frontend:**
   ```bash
   npm run dev:frontend
   ```
   Runs on `http://localhost:5173`, calls Worker at `localhost:8787`.

### Testing Flows

- **Student signup & RIASEC:** Go to landing, sign up, complete RIASEC assessment
- **SCCT & results:** Continue with SCCT, view recommendations
- **AI chat:** Click "AI Counselor" and ask a question (first request seeds Vectorize in background)
- **Counselor login:** Use a counselor account to create departments and view student results

---

## Deployment

### Via GitHub Actions (Recommended)

1. **Set repository secrets** in GitHub:
   - `CLOUDFLARE_API_TOKEN` (from https://dash.cloudflare.com/profile/api-tokens)
   - `CLOUDFLARE_ACCOUNT_ID` (from your Cloudflare dashboard)

2. **Cloudflare Worker secrets** (set once via CLI or dashboard):
   ```bash
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put FRONTEND_ORIGIN
   ```

3. **Push to `master`** — GitHub Actions automatically:
   - Installs dependencies
   - Builds frontend bundle
   - Deploys Worker + assets

### Manual Deployment

```bash
# Build
npm run build

# Deploy
npm run deploy:worker
```

---

## Cloudflare AI Stack

### Architecture

All AI requests use **Cloudflare's native infrastructure** — no external API keys.

```
Student asks question
    ↓
POST /ai/explain (or /ai/sessions/:id/chat)
    ↓
retrieveContext()  ← embed question + query Vectorize for top-4 docs
    ↓
runLlama()  ← inject docs into system prompt, call Llama 3.1 8B via AI Gateway
    ↓
Response logged to AI Gateway dashboard (tokens, latency, cost)
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| **Workers AI** | [`ai.ts`](apps/worker/src/ai.ts) | Llama 3.1 8B inference + embeddings (baai/bge) |
| **Vectorize** | N/A (configured in `wrangler.toml`) | Vector database (768-dim, cosine similarity) |
| **Knowledge Corpus** | [`knowledge.ts`](apps/worker/src/knowledge.ts) | ~101 docs (strands, RIASEC, SCCT, courses, careers) |
| **AI Gateway** | `wrangler.toml` (`AI_GATEWAY_ID`) | Request logging & analytics |
| **Scheduled Cron** | `wrangler.toml` (`[triggers]`) | Daily re-seed at 2 AM UTC |

### Adding Knowledge

Edit [`apps/worker/src/knowledge.ts`](apps/worker/src/knowledge.ts):

1. **Add strand, RIASEC type, or SCCT construct:**
   - Push to the respective array at the top (STRANDS, RIASEC_DIMS, SCCT_CONSTRUCTS)
   - Each has `{ code, name, text }`

2. **Add arbitrary knowledge doc:**
   - In `buildKnowledgeCorpus()`, create `{ id: 'unique-key', kind: 'category', text: 'content' }`
   - All docs get embedded and indexed on next seed

3. **Trigger immediate re-seed:**
   - Call `POST /admin/seed-knowledge` with counselor JWT, OR
   - Auto-triggers on next AI request (if not yet seeded)

4. **Monitor dashboard:**
   - **Vectorize:** https://dash.cloudflare.com → Workers & Pages → careerlinkai → Vectorize
   - **AI Gateway:** https://dash.cloudflare.com → AI → careerlinkai-beta-ai-gateway

### Restricting AI Behavior

Edit system prompts in [`apps/worker/src/index.ts`](apps/worker/src/index.ts):

- **`getExplainAiReply()`** — System prompt for `/ai/explain` (one-off Q&A)
- **`getCounselorAiReply()`** — System prompt for `/ai/sessions/:id/chat` (multi-turn)

Example restriction to add:
```typescript
// In system prompt:
"Only answer questions about career guidance, RIASEC, SCCT, strands, or academics.
If asked about unrelated topics, politely redirect to career topics.
Never give medical, legal, or financial advice."
```

---

## Database Schema

See [`apps/worker/schema.sql`](apps/worker/schema.sql) for the complete schema. Key tables:

- **users** — id, email, password_hash, name, role (student/counselor), created_at
- **profiles** — user_id, school, strand, gwa, grade_level, gender, birthdate, grades_json
- **assessment_riasec** — user_id, question_id, answer (1-5), submitted_at
- **assessment_scct** — user_id, question_id, answer (1-5), submitted_at
- **results** — user_id, holland_code, riasec_json, scct_json, courses_json, careers_json, generated_at
- **ai_chat_sessions** — id, student_id, title, created_at, updated_at
- **ai_chat_messages** — id, session_id, role (student/assistant), content, created_at
- **departments** — id, counselor_id, name, strand, join_code, created_at
- **department_members** — department_id, student_id
- **system_config** — key (ai_enabled, vectorize_seeded), value, updated_at
- **notifications** — id, user_id, kind, title, body, read, created_at

---

## Scoring Method

### RIASEC
- 48 items total: 8 items per dimension (R, I, A, S, E, C)
- Dimension score = mean of its 8 item responses (1-5 scale)
- **Holland Code** = concatenated 3-letter code of top 3 dimensions (highest to lowest average)

### SCCT
- 12 items grouped into 3 constructs:
  - **Self-efficacy** (items 1-4) — belief in own ability
  - **Outcome expectations** (items 5-8) — belief in positive outcomes
  - **Perceived barriers** (items 9-12) — belief in obstacles
- Construct score = mean of its 4 items (1-5 scale)

### Course/Career Match
- Weighted dot product: student's RIASEC vector × course/career's canonical RIASEC profile
- Match % = rounded dot product result (0-100)

---

## Troubleshooting

### Worker deploy fails: "assets directory missing"
```bash
npm run build         # Build frontend bundle first
npm run deploy:worker # Then deploy
```

### Frontend can't reach API
- Check `apps/frontend/.env`: `VITE_API_BASE=http://localhost:8787` (dev) or deployed Worker URL (prod)
- Ensure Worker is running on `npm run dev:worker`

### Windows blocks frontend build
Use Linux CI (GitHub Actions) for production builds. Local Vite builds are pinned to 4.x to avoid native module issues.

### AI replies are rule-based, not using knowledge
- Check Vectorize dashboard: confirm `careerlinkai-knowledge` index has ~100 vectors
- First AI request triggers seeding in background — try again after a few seconds
- Or manually call `POST /admin/seed-knowledge` to force immediate seed

---

## Security Notes

- **Passwords:** Hashed with PBKDF2-SHA256 (Web Crypto API)
- **JWTs:** Signed HS256, 30-day expiry
- **CORS:** Restricted to `FRONTEND_ORIGIN` in production
- **AI calls:** All routed through Cloudflare infrastructure (never external)
- **D1 queries:** Parameter-bound (no SQL injection)
- **Notifications:** WebSocket over Durable Objects (real-time, one-to-many broadcast)

---

## Support

- **Questions about features?** Check the relevant page or route in the navigation guide above.
- **Need to add/modify knowledge?** Edit [`apps/worker/src/knowledge.ts`](apps/worker/src/knowledge.ts) and re-seed.
- **Need to change AI behavior?** Edit system prompts in [`apps/worker/src/index.ts`](apps/worker/src/index.ts).
- **Issues or feedback?** See [CLAUDE.md](CLAUDE.md) for developer tips.
