# Cloudflare AI Integration Guide

This document explains the Cloudflare AI integration in CareerLinkAI: what is integrated, how requests flow, where each integration point lives, and how to tune or extend the system.

## 1. What Is Integrated

CareerLinkAI uses a Cloudflare-native Retrieval-Augmented Generation (RAG) stack:

1. Workers AI for generation and embeddings.
2. Vectorize as the knowledge retrieval store.
3. AI Gateway for centralized logging/observability of AI calls.
4. D1 for persistent chat sessions/messages and seed state tracking.
5. Rule-based fallback behavior when AI generation is unavailable.

### Current model choices

1. Embeddings model: @cf/baai/bge-base-en-v1.5.
2. LLM model: @cf/meta/llama-3.1-8b-instruct.

Both model constants are defined in apps/worker/src/ai.ts.

## 2. Where The Integration Lives

### Worker runtime and AI orchestration

1. apps/worker/wrangler.toml
- Declares bindings for AI and Vectorize.
- Stores AI gateway id in vars (AI_GATEWAY_ID).
- Configures daily cron trigger for knowledge refresh.

2. apps/worker/src/ai.ts
- embed: single-text embedding call.
- embedBatch: batch embedding call.
- retrieveContext: vector query into KNOWLEDGE index.
- runLlama: LLM inference call through AI Gateway.

3. apps/worker/src/knowledge.ts
- buildKnowledgeCorpus: produces the base domain corpus (strands, RIASEC, SCCT, course/career docs).
- seedKnowledge: embeds and upserts corpus docs into Vectorize in batches.

4. apps/worker/src/index.ts
- ensureVectorizeSeed: lazy seed-on-first-use + DB flag update.
- getExplainAiReply: prompt and retrieval logic for one-shot explanation endpoint.
- getCounselorAiReply: prompt and retrieval logic for multi-turn chat endpoint.
- /ai/explain route.
- /ai/sessions, /ai/sessions/:id/messages, /ai/sessions/:id/chat routes.
- /admin/seed-knowledge route.
- scheduled handler calling seedKnowledge for periodic refresh.

### Frontend integration points

1. apps/frontend/src/lib/api.ts
- Sets API base URL and auth header behavior.

2. apps/frontend/src/pages/StudentResults.tsx
- Calls POST /ai/explain for result-aware Q and A.

3. apps/frontend/src/pages/StudentAICounselor.tsx
- Uses session APIs for multi-turn counselor chat.
- Displays structured assistant output (bullets, numbering, bold).
- Applies word-by-word typewriter rendering for new assistant messages.

## 3. Cloudflare Binding and Config Details

Configured in apps/worker/wrangler.toml:

1. AI binding
- Section: [ai]
- Binding name in code: AI

2. Vectorize index
- Section: [[vectorize]]
- Binding name in code: KNOWLEDGE
- Index: careerlinkai-knowledge

3. Gateway id
- Section: [vars]
- Variable name in code: AI_GATEWAY_ID
- Passed into every env.AI.run call via gateway option.

4. Cron for reseeding
- Section: [triggers]
- Cron: 0 2 * * * (daily at 02:00 UTC)

## 4. How AI Calls Work End To End

### Flow A: Result-aware one-shot explanation (POST /ai/explain)

1. Frontend (StudentResults page) sends question.
2. Worker validates auth, role, and question length.
3. Worker loads student context from D1:
- Holland code.
- Top course/career.
- SCCT values.
- Strand.
4. Worker computes a rule-based fallback response first.
5. Worker starts lazy vector seed in background via executionCtx.waitUntil(ensureVectorizeSeed(...)).
6. Worker calls getExplainAiReply:
- retrieveContext(topK=4).
- Build system prompt with student context + retrieved snippets.
- runLlama with temperature 0.5 and maxTokens 360.
7. If AI returns valid text, source is ai.
8. If AI fails or returns empty, fallback response is returned with source rule_based.

### Flow B: Multi-turn counselor chat (POST /ai/sessions/:id/chat)

1. Frontend (StudentAICounselor page) creates/selects a session.
2. User message is persisted to ai_chat_messages.
3. Session metadata is updated (title, updated_at).
4. Worker loads recent history and student profile context.
5. Worker starts lazy vector seed in background.
6. Worker calls getCounselorAiReply:
- retrieveContext(topK=4).
- Build domain-restricted system prompt.
- Inject recent conversation turns + current question.
- runLlama with temperature 0.6 and maxTokens 400.
7. Assistant reply is persisted to ai_chat_messages.
8. Frontend renders assistant reply with:
- Word-by-word typewriter effect.
- Bullet/numbered list formatting.
- Bold highlight parsing.

## 5. Prompt Strategy and Behavior Controls

Prompt logic is defined in apps/worker/src/index.ts.

1. getExplainAiReply prompt
- Concise explanation style for assessment-linked answers.
- Uses explicit student context fields.

2. getCounselorAiReply prompt
- Restricts topics to counseling/academic domains.
- Explicitly instructs decline-and-redirect for out-of-scope queries.
- Enforces response format guidance: short paragraphs, bullets or numbered steps when listing, and bold emphasis for key advice.

If you need to adjust assistant personality, scope, output style, or verbosity, this is the first place to edit.

## 6. Knowledge Base Lifecycle (Vectorize)

Knowledge generation and seeding are in apps/worker/src/knowledge.ts.

1. Corpus composition
- Strand explanations.
- RIASEC dimension explanations.
- SCCT construct explanations.
- Course/career derived documents from predictor labels.

2. Embedding and upsert
- embedBatch called in chunks of 16 documents.
- Upserts vectors with metadata fields text and kind.

3. Seed triggers
- Lazy first-use seed in ensureVectorizeSeed.
- Manual seed endpoint: POST /admin/seed-knowledge.
- Scheduled daily seed via Worker cron.

4. Seed state tracking
- D1 table: system_config.
- Key used: vectorize_seeded = 1.

## 7. Persistence and Data Surfaces Used By AI

AI-related persistence in D1 includes:

1. ai_chat_sessions
- Per-student chat threads.

2. ai_chat_messages
- Ordered user and assistant messages.

3. system_config
- Operational flags like vectorize_seeded.

The chat API supports list/create/delete sessions, list messages, and send chat messages.

## 8. Reliability and Fallback Design

The integration is resilient by design:

1. AI helper functions catch and log failures, then return null.
2. /ai/explain always has rule-based fallback logic.
3. /ai/sessions/:id/chat falls back to a safe temporary failure message.
4. Seeding failures do not crash API routes.
5. Empty retrieval results still allow LLM generation (without retrieved snippets).

## 9. Security and Scope Boundaries

1. AI routes require JWT auth and student role checks.
2. CORS is restricted to configured frontend origin(s).
3. Topic boundaries are enforced in prompt instructions.
4. All AI calls are through Cloudflare services (no third-party model provider in active flow).

## 10. How To Tune and Extend

### Tune model and generation behavior

1. Change model constants in apps/worker/src/ai.ts.
2. Adjust temperature and maxTokens in getExplainAiReply/getCounselorAiReply calls.

### Tune retrieval behavior

1. Adjust topK in retrieveContext calls from index.ts.
2. Expand or refine corpus docs in knowledge.ts.

### Tune response format quality

1. Update formatting instructions in getCounselorAiReply system prompt.
2. Frontend renderer for bullets/numbering/bold is in StudentAICounselor page.

### Tune chat UX rendering speed

1. Typewriter delay and token step are in apps/frontend/src/pages/StudentAICounselor.tsx.

### Force refresh knowledge

1. Call POST /admin/seed-knowledge (counselor-authenticated).
2. Or wait for daily scheduled seed.

## 11. Operational Checklist

Before production use, confirm:

1. AI binding exists and Worker has AI access.
2. Vectorize index careerlinkai-knowledge exists and is bound as KNOWLEDGE.
3. AI_GATEWAY_ID in wrangler vars matches an existing gateway.
4. Deployed Worker can call /ai/explain and /ai/sessions/:id/chat successfully.
5. /admin/seed-knowledge returns healthy upsert stats.

## 12. Quick File Reference

1. apps/worker/wrangler.toml
2. apps/worker/src/ai.ts
3. apps/worker/src/knowledge.ts
4. apps/worker/src/index.ts
5. apps/frontend/src/lib/api.ts
6. apps/frontend/src/pages/StudentResults.tsx
7. apps/frontend/src/pages/StudentAICounselor.tsx
