import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateOpaqueToken, hashOpaqueToken, hashPassword, randomJoinCode, signToken, verifyPassword, verifyToken } from './auth';
import { passwordResetEmail, sendEmail, verificationEmail } from './email';
import { hollandCode, scoreRiasec, scoreScct } from './scoring';
import { predictFromDatasetMl } from './ml/predictor';
import { retrieveContext, runLlama, type ChatMessage, type RetrievedDoc } from './ai';
import { seedKnowledge, SCCT_QUESTIONS } from './knowledge';
import { buildStudentContext, renderContextForPrompt, type StudentContext } from './studentContext';
import { clientIp, rateLimit } from './rateLimit';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  FRONTEND_ORIGIN: string;
  AI: Ai;
  KNOWLEDGE: VectorizeIndex;
  AI_GATEWAY_ID: string;
  NOTIFICATIONS: DurableObjectNamespace;
  RATE_LIMITS: KVNamespace;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  RESEND_FROM_NAME: string;
};

type Variables = {
  userId: number;
  userRole: 'student' | 'counselor';
  userEmail: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Required at runtime — missing any of these makes the whole worker non-functional.
const REQUIRED_ENV_VARS: (keyof Bindings)[] = ['JWT_SECRET', 'FRONTEND_ORIGIN'];

function validateEnv(env: Bindings): string[] {
  return REQUIRED_ENV_VARS.filter(key => !env[key as keyof Bindings]);
}

const REQUIRED_RIASEC_COUNT = 48;
const REQUIRED_SCCT_COUNT = 12;
const SUBJECT_KEYS = ['Math', 'English', 'Science'] as const;
const GRADE_LEVELS = ['7', '8', '9', '10'] as const;
const JOIN_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const API_ROUTE_PREFIXES = [
  '/health',
  '/auth',
  '/profile',
  '/assessment',
  '/results',
  '/ai',
  '/counselor',
  '/join',
  '/student',
  '/notifications',
  '/ws',
  '/schools'
] as const;

const PROFILE_SCHEMA_COLUMNS = [
  { name: 'school', definition: 'school TEXT' },
  { name: 'grade_level', definition: 'grade_level TEXT' },
  { name: 'gender', definition: 'gender TEXT' },
  { name: 'birthdate', definition: 'birthdate TEXT' },
  { name: 'contact_number', definition: 'contact_number TEXT' },
  { name: 'guardian_name', definition: 'guardian_name TEXT' },
  { name: 'first_name', definition: 'first_name TEXT' },
  { name: 'last_name', definition: 'last_name TEXT' },
  { name: 'ai_external_consent', definition: 'ai_external_consent INTEGER NOT NULL DEFAULT 0' },
  { name: 'ai_external_consent_at', definition: 'ai_external_consent_at INTEGER' },
  { name: 'basics_completed', definition: 'basics_completed INTEGER NOT NULL DEFAULT 0' },
  { name: 'updated_at', definition: 'updated_at INTEGER' }
] as const;

let ensureProfilesSchemaPromise: Promise<void> | null = null;
let ensureSeminarsSchemaPromise: Promise<void> | null = null;
let ensureNotificationsSchemaPromise: Promise<void> | null = null;
let ensureAiChatSchemaPromise: Promise<void> | null = null;
let ensureAuthSchemaPromise: Promise<void> | null = null;
let vectorizeReady = false;

async function ensureVectorizeSeed(env: Bindings): Promise<void> {
  if (vectorizeReady) return;
  try {
    const row = await env.DB.prepare('SELECT value FROM system_config WHERE key = ?')
      .bind('vectorize_seeded').first<{ value: string }>();
    if (row?.value === '1') { vectorizeReady = true; return; }
  } catch { /* system_config may not exist yet */ }
  const result = await seedKnowledge(env);
  if (result.upserted > 0 && result.failedBatches === 0) {
    vectorizeReady = true;
    await env.DB.prepare(
      `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, unixepoch())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind('vectorize_seeded', '1').run().catch(() => {});
  }
}

async function ensureSeminarsSchema(db: D1Database): Promise<void> {
  if (ensureSeminarsSchemaPromise) return ensureSeminarsSchemaPromise;
  ensureSeminarsSchemaPromise = (async () => {
    const info = await db.prepare('PRAGMA table_info(seminars)').all<{ name: string }>();
    const cols = new Set((info.results ?? []).map(r => String(r.name)));
    if (!cols.has('venue')) {
      await db.prepare('ALTER TABLE seminars ADD COLUMN venue TEXT').run();
    }
  })().catch(err => {
    ensureSeminarsSchemaPromise = null;
    throw err;
  });
  return ensureSeminarsSchemaPromise;
}

async function ensureNotificationsSchema(db: D1Database): Promise<void> {
  if (ensureNotificationsSchemaPromise) return ensureNotificationsSchemaPromise;
  ensureNotificationsSchemaPromise = (async () => {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`
    ).run();
    await db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`
    ).run();
  })().catch(err => {
    ensureNotificationsSchemaPromise = null;
    throw err;
  });
  return ensureNotificationsSchemaPromise;
}

async function ensureAiChatSchema(db: D1Database): Promise<void> {
  if (ensureAiChatSchemaPromise) return ensureAiChatSchemaPromise;
  ensureAiChatSchemaPromise = (async () => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'New conversation',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_sessions_student ON ai_chat_sessions(student_id, updated_at DESC)`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_chat_messages(session_id, created_at ASC)`).run();
  })().catch(err => {
    ensureAiChatSchemaPromise = null;
    throw err;
  });
  return ensureAiChatSchemaPromise;
}

async function ensureAuthSchema(db: D1Database): Promise<void> {
  if (ensureAuthSchemaPromise) return ensureAuthSchemaPromise;
  ensureAuthSchemaPromise = (async () => {
    // Add email_verified column to existing users tables (idempotent).
    const userInfo = await db.prepare('PRAGMA table_info(users)').all<{ name: string }>();
    const userCols = new Set((userInfo.results ?? []).map(r => String(r.name)));
    if (!userCols.has('email_verified')) {
      await db.prepare('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0').run();
    }
    await db.prepare(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash)`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash)`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`).run();
  })().catch(err => {
    ensureAuthSchemaPromise = null;
    throw err;
  });
  return ensureAuthSchemaPromise;
}

let ensureSchoolsSchemaPromise: Promise<void> | null = null;
async function ensureSchoolsSchema(db: D1Database): Promise<void> {
  if (ensureSchoolsSchemaPromise) return ensureSchoolsSchemaPromise;
  ensureSchoolsSchemaPromise = (async () => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`).run();
    await db.prepare("INSERT OR IGNORE INTO schools (name) VALUES (?)").bind('Calape National High School').run();
  })().catch(err => {
    ensureSchoolsSchemaPromise = null;
    throw err;
  });
  return ensureSchoolsSchemaPromise;
}

async function issueTokenPair(
  env: Bindings,
  u: { id: number; role: string; email: string }
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signToken(
    { sub: String(u.id), role: u.role as 'student' | 'counselor', email: u.email },
    env.JWT_SECRET
  );
  await ensureAuthSchema(env.DB);
  const raw = generateOpaqueToken();
  const hash = await hashOpaqueToken(raw);
  const expires = Math.floor(Date.now() / 1000) + 7 * 86400;
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(u.id, hash, expires).run();
  return { accessToken, refreshToken: raw };
}

async function pushNotification(
  env: Bindings,
  userId: number,
  payload: { id: number; kind: string; title: string; body: string; createdAt: number }
): Promise<void> {
  try {
    const stub = env.NOTIFICATIONS.get(env.NOTIFICATIONS.idFromName(String(userId)));
    await stub.fetch(new Request('https://do/push', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  } catch {
    // notification already persisted in DB; ignore push failure
  }
}

async function ensureProfilesSchema(db: D1Database): Promise<void> {
  if (ensureProfilesSchemaPromise) return ensureProfilesSchemaPromise;

  ensureProfilesSchemaPromise = (async () => {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        strand TEXT,
        gwa REAL,
        grades_json TEXT,
        school TEXT,
        grade_level TEXT,
        gender TEXT,
        birthdate TEXT,
        contact_number TEXT,
        guardian_name TEXT,
        ai_external_consent INTEGER NOT NULL DEFAULT 0,
        ai_external_consent_at INTEGER,
        basics_completed INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`
    ).run();

    const tableInfo = await db.prepare('PRAGMA table_info(profiles)').all<{ name: string }>();
    const existingColumns = new Set((tableInfo.results ?? []).map(row => String(row.name)));

    for (const col of PROFILE_SCHEMA_COLUMNS) {
      if (existingColumns.has(col.name)) continue;
      await db.prepare(`ALTER TABLE profiles ADD COLUMN ${col.definition}`).run();
    }
  })().catch(err => {
    ensureProfilesSchemaPromise = null;
    throw err;
  });

  return ensureProfilesSchemaPromise;
}

function isApiRoute(pathname: string): boolean {
  for (const prefix of API_ROUTE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeStrand(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function normalizeGwa(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = asNumber(value);
  if (n === null) return null;
  if (n < 0 || n > 100) return null;
  return Number(n.toFixed(2));
}

function normalizeJoinCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase().replace(/[\s-]/g, '');
}

function isValidJoinCode(code: string): boolean {
  return JOIN_CODE_REGEX.test(code);
}

function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD_REGEX.test(password);
}

function readSubjectAlias(source: Record<string, any>, subject: string): unknown {
  const aliases = subject === 'Math'
    ? ['Math', 'math', 'Mathematics', 'mathematics']
    : [subject, subject.toLowerCase()];
  for (const key of aliases) {
    if (key in source) return source[key];
  }
  return undefined;
}

function normalizeGradeRecord(rawGrades: unknown): Record<string, any> | null {
  if (!rawGrades || typeof rawGrades !== 'object' || Array.isArray(rawGrades)) return null;
  const source = rawGrades as Record<string, any>;
  const normalized: Record<string, any> = {};

  for (const subject of SUBJECT_KEYS) {
    const subjectValue = readSubjectAlias(source, subject);
    const subjectOut: Record<string, number> = {};

    if (typeof subjectValue === 'number' && Number.isFinite(subjectValue)) {
      const clamped = Math.max(0, Math.min(100, subjectValue));
      for (const level of GRADE_LEVELS) subjectOut[level] = Number(clamped.toFixed(2));
    } else {
      const nested = subjectValue && typeof subjectValue === 'object' && !Array.isArray(subjectValue)
        ? subjectValue as Record<string, any>
        : {};

      for (const level of GRADE_LEVELS) {
        const flatCandidates = [
          `${subject}_${level}`,
          `${subject}-${level}`,
          `${subject}${level}`,
          `${subject.toLowerCase()}_${level}`,
          `${subject.toLowerCase()}-${level}`,
          `${subject.toLowerCase()}${level}`
        ];

        const nestedCandidates = [
          nested[level],
          nested[`grade${level}`],
          nested[`Grade${level}`],
          nested[`Grade ${level}`],
          nested[`g${level}`],
          nested[`G${level}`]
        ];

        let value = nestedCandidates
          .map(candidate => asNumber(candidate))
          .find(candidate => candidate !== null) ?? null;

        if (value === null) {
          for (const key of flatCandidates) {
            value = asNumber(source[key]);
            if (value !== null) break;
          }
        }

        if (value === null || value < 0 || value > 100) return null;
        subjectOut[level] = Number(value.toFixed(2));
      }
    }

    const average = GRADE_LEVELS.reduce((sum, level) => sum + subjectOut[level], 0) / GRADE_LEVELS.length;
    normalized[subject] = {
      ...subjectOut,
      average: Number(average.toFixed(2))
    };
  }

  return normalized;
}

function hasCompleteAnswers(answers: Record<number, number>, total: number): boolean {
  for (let id = 1; id <= total; id++) {
    if (!(id in answers)) return false;
  }
  return true;
}

function buildRuleBasedAiReply(question: string, context: {
  hollandCode: string;
  topCourse: string;
  topCareer: string;
  strand: string | null;
  scct: Record<string, number>;
}): string {
  const q = question.toLowerCase();
  const se = context.scct.self_efficacy ?? 3;
  const oe = context.scct.outcome_expectations ?? 3;
  const barriers = context.scct.perceived_barriers ?? 3;

  if (q.includes('why') || q.includes('match') || q.includes('recommend')) {
    return `Your top recommendation (${context.topCourse}) aligns with your Holland code ${context.hollandCode} and current strand ${context.strand ?? 'N/A'}. Your SCCT profile (self-efficacy ${se.toFixed(1)}, outcome expectations ${oe.toFixed(1)}, barriers ${barriers.toFixed(1)}) suggests you are likely to persist when learning feels meaningful and practical.`;
  }
  if (q.includes('improve') || q.includes('prepare') || q.includes('next step')) {
    return `To prepare for ${context.topCourse}, build weekly habits in core subjects and portfolio tasks linked to ${context.topCareer}. Focus first on improving confidence-building routines because your self-efficacy score is ${se.toFixed(1)}.`;
  }
  return `Based on your results, ${context.topCourse} and ${context.topCareer} are strong paths for your ${context.hollandCode} profile. Ask me about study plan, skill roadmap, or day-to-day work in either path.`;
}

const KNOWLEDGE_TARGET_TOP_K = 6;
const KNOWLEDGE_MIN_SCORE = 0.65;
const KNOWLEDGE_MIN_CONFIDENT_DOCS = 2;

function isScctInterpretationQuestion(question: string): boolean {
  const q = question.toLowerCase();
  const mentionsScct = q.includes('scct')
    || q.includes('self-efficacy')
    || q.includes('self efficacy')
    || q.includes('outcome expectation')
    || q.includes('perceived barrier');
  const asksInterpretation = q.includes('score') || q.includes('interpret') || q.includes('meaning');
  return mentionsScct || (asksInterpretation && (q.includes('self') || q.includes('outcome') || q.includes('barrier')));
}

function formatScctQuestionReferenceBlock(): string {
  return '\nSCCT questionnaire reference (12 items):\n' +
    SCCT_QUESTIONS.map(q => `Q${q.id} [${q.construct}]: ${q.prompt}`).join('\n');
}

function selectGroundedKnowledge(retrieved: RetrievedDoc[]): RetrievedDoc[] {
  if (!retrieved.length) return [];
  const confident = retrieved.filter(r => Number.isFinite(r.score) && r.score >= KNOWLEDGE_MIN_SCORE);
  if (confident.length >= KNOWLEDGE_MIN_CONFIDENT_DOCS) return confident.slice(0, 4);
  const topScore = retrieved[0]?.score ?? 0;
  if (topScore >= KNOWLEDGE_MIN_SCORE + 0.1) return retrieved.slice(0, 1);
  return [];
}

function hasSourceUrls(docs: RetrievedDoc[]): boolean {
  return docs.some(d => typeof d.sourceUrl === 'string' && d.sourceUrl.length > 0);
}

function formatKnowledgeBlock(docs: RetrievedDoc[]): string {
  if (!docs.length) return '';
  return '\nReference notes from CareerLinkAI knowledge base:\n' +
    docs.map((d, i) => `(${i + 1}) ${d.text}${d.sourceUrl ? ` [source: ${d.sourceUrl}]` : ''}`).join('\n');
}

async function getExplainAiReply(
  env: Bindings,
  question: string,
  context: StudentContext
): Promise<string | null> {
  const retrieved = await retrieveContext(env, question, KNOWLEDGE_TARGET_TOP_K);
  const groundedDocs = selectGroundedKnowledge(retrieved);
  if (!groundedDocs.length) return null;

  const knowledge = formatKnowledgeBlock(groundedDocs);
  const scctQuestionReference = isScctInterpretationQuestion(question)
    ? formatScctQuestionReferenceBlock()
    : '';
  const sourceCitationInstruction = hasSourceUrls(groundedDocs)
    ? 'If you use facts from a referenced source URL, include a final line "Sources:" with only the URLs you used.'
    : '';

  const systemPrompt = [
    'You are a career counselor assistant for senior high school students in the Philippines.',
    'Explain recommendations in plain, encouraging language, no markdown, and keep it under 180 words.',
    'Ground factual claims strictly on the reference notes below. If references do not support a claim, say you are unsure instead of guessing.',
    sourceCitationInstruction,
    scctQuestionReference ? 'When discussing SCCT score interpretation, explicitly anchor your explanation to the SCCT questionnaire items below.' : '',
    'Address the student by their first name when natural and tailor the reasoning to their strand, grade level, and SCCT scores.',
    `\nStudent profile:\n${renderContextForPrompt(context)}`,
    knowledge,
    scctQuestionReference
  ].filter(Boolean).join('\n');

  return runLlama(
    env,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ],
    { temperature: 0.5, maxTokens: 360 }
  );
}

async function getCounselorAiReply(
  env: Bindings,
  context: StudentContext,
  history: Array<{ role: string; content: string }>,
  question: string
): Promise<string | null> {
  const retrieved = await retrieveContext(env, question, KNOWLEDGE_TARGET_TOP_K);
  const groundedDocs = selectGroundedKnowledge(retrieved);
  if (!groundedDocs.length) return null;

  const knowledge = formatKnowledgeBlock(groundedDocs);
  const scctQuestionReference = isScctInterpretationQuestion(question)
    ? formatScctQuestionReferenceBlock()
    : '';
  const sourceCitationInstruction = hasSourceUrls(groundedDocs)
    ? 'If you use facts from a referenced source URL, include a final line "Sources:" with up to 3 URLs you used.'
    : '';

  const statusGuidance =
    context.assessmentStatus === 'complete'
      ? 'The student has completed both assessments. When giving advice, tailor it to their Holland code, SCCT scores, strand, grade level, and other known details below.'
      : context.assessmentStatus === 'in_progress'
      ? 'The student has NOT finished the assessment yet. Do not invent a Holland code or SCCT scores. Encourage them to finish the remaining items, and answer general questions using what is known (strand, grade level, school, subjects).'
      : 'The student has NOT started the assessment yet. Do not invent a Holland code or SCCT scores. Greet them by name, answer general questions, and encourage them to take the assessment.';

  const systemPrompt = [
    'You are a career counseling assistant for senior high school students in the Philippines.',
    'You ONLY answer questions about: academic strand choices (STEM, ABM, HUMSS, TVL/ICT), college courses,',
    'Holland/RIASEC personality types, SCCT (Social Cognitive Career Theory), career path planning,',
    'Philippine universities and colleges, study habits, and professional development for Filipino students.',
    'If asked anything outside these topics, politely decline and redirect to career or academic guidance.',
    'Ground factual claims strictly on the reference notes below. If references do not support a claim, ask for clarification instead of guessing.',
    sourceCitationInstruction,
    scctQuestionReference ? 'When discussing SCCT score interpretation, explicitly anchor your explanation to the SCCT questionnaire items below.' : '',
    'Format responses clearly using simple Markdown-style structure.',
    'Use short paragraphs and use bullet points (-) or numbered steps (1.) when listing recommendations.',
    'Highlight key advice with **bold** text.',
    'Keep responses encouraging and under 220 words.',
    'Address the student by their first name when natural.',
    statusGuidance,
    `\nStudent profile:\n${renderContextForPrompt(context)}`,
    knowledge,
    scctQuestionReference
  ].filter(Boolean).join('\n');

  const msgs: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(h => ({
      role: (h.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: h.content
    })),
    { role: 'user', content: question },
  ];

  return runLlama(env, msgs, { temperature: 0.6, maxTokens: 400 });
}

app.use('*', (c, next) => {
  // FRONTEND_ORIGIN is guaranteed set — validateEnv blocks requests if it's missing.
  return cors({
    origin: [c.env.FRONTEND_ORIGIN],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  })(c, next);
});

// -------- Auth middleware --------
async function auth(c: any, next: any) {
  const h = c.req.header('authorization') || '';
  const m = /^Bearer (.+)$/.exec(h);
  if (!m) return c.json({ error: 'Unauthorized' }, 401);
  const payload = await verifyToken(m[1], c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Invalid token' }, 401);
  c.set('userId', parseInt(payload.sub, 10));
  c.set('userRole', payload.role);
  c.set('userEmail', payload.email);
  await next();
}

function requireRole(role: 'student' | 'counselor') {
  return async (c: any, next: any) => {
    if (c.get('userRole') !== role) return c.json({ error: 'Forbidden' }, 403);
    await next();
  };
}

// -------- Health --------
app.get('/health', c => c.json({ ok: true, service: 'CareerLinkAI API', version: '1.0.0' }));

// -------- Schools (public) --------
app.get('/schools', async c => {
  await ensureSchoolsSchema(c.env.DB);
  const { results } = await c.env.DB.prepare(
    'SELECT name FROM schools WHERE active = 1 ORDER BY name ASC'
  ).all<{ name: string }>();
  return c.json({ schools: (results ?? []).map(r => r.name) });
});

// -------- Auth routes --------
app.post('/auth/signup', async c => {
  const ip = clientIp(c.req.raw.headers);
  const rl = await rateLimit(c.env.RATE_LIMITS, `signup:${ip}`, 1, 60);
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: 'Too many signup attempts. Try again later.' }, 429);
  }
  const body = await c.req.json<{
    name?: string;
    firstName?: string;
    lastName?: string;
    school?: string;
    inviteCode?: string;
    acceptedPolicies?: boolean;
    email: string;
    password: string;
    role: 'student' | 'counselor';
  }>();
  const firstName = (body.firstName || '').trim();
  const lastName = (body.lastName || '').trim();
  const combinedName = (body.name || `${firstName} ${lastName}`).trim();
  const school = (body.school || '').trim();
  const inviteCode = normalizeJoinCode(body.inviteCode || '');

  if (!body.email || !body.password) return c.json({ error: 'Missing fields' }, 400);
  if (!combinedName) return c.json({ error: 'Name is required.' }, 400);
  if (body.password.length < 8) return c.json({ error: 'Password must be at least 8 characters.' }, 400);
  if (!isStrongPassword(body.password)) {
    return c.json({ error: 'Password must include uppercase, lowercase, number, and special character.' }, 400);
  }
  if (body.acceptedPolicies !== true) {
    return c.json({ error: 'You must agree to the Terms and Privacy Policy.' }, 400);
  }
  if (!['student', 'counselor'].includes(body.role)) return c.json({ error: 'Invalid role' }, 400);
  if (body.role === 'counselor') {
    if (!firstName || !lastName) return c.json({ error: 'First and last name are required.' }, 400);
    if (!school) return c.json({ error: 'School is required for counselor sign up.' }, 400);
  }

  let invitedDepartment: { id: number; name: string; strand: string; counselorId: number } | null = null;
  if (body.role === 'student') {
    if (!inviteCode) return c.json({ error: 'Invitation code is required for student sign up.' }, 400);
    if (!isValidJoinCode(inviteCode)) {
      return c.json({ error: 'Invitation code must be 6 characters using letters and numbers.' }, 400);
    }
    invitedDepartment = await c.env.DB.prepare(
      'SELECT id, name, strand, counselor_id AS counselorId FROM departments WHERE join_code = ?'
    ).bind(inviteCode).first<{ id: number; name: string; strand: string; counselorId: number }>();
    if (!invitedDepartment) return c.json({ error: 'Invalid invitation code.' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(body.email.toLowerCase()).first();
  if (existing) return c.json({ error: 'An account with that email already exists.' }, 409);

  const { hash, salt } = await hashPassword(body.password);
  const inserted = await c.env.DB.prepare(
    'INSERT INTO users (email, name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?) RETURNING id'
  )
    .bind(body.email.toLowerCase(), combinedName, body.role, hash, salt)
    .first<{ id: number }>();
  if (!inserted) return c.json({ error: 'Could not create user' }, 500);

  if (firstName || lastName || school || invitedDepartment?.strand) {
    await ensureProfilesSchema(c.env.DB);
    await c.env.DB.prepare(
      `INSERT INTO profiles (user_id, first_name, last_name, school, strand, updated_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(user_id) DO UPDATE SET
         first_name=COALESCE(excluded.first_name, profiles.first_name),
         last_name=COALESCE(excluded.last_name, profiles.last_name),
         school=COALESCE(excluded.school, profiles.school),
         strand=CASE
           WHEN profiles.strand IS NULL OR trim(profiles.strand) = '' THEN excluded.strand
           ELSE profiles.strand
         END,
         updated_at=unixepoch()`
    ).bind(inserted.id, firstName || null, lastName || null, school || null, invitedDepartment?.strand ?? null).run();
  }

  if (invitedDepartment) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO department_members (department_id, student_id) VALUES (?, ?)'
    ).bind(invitedDepartment.id, inserted.id).run();

    await c.env.DB.prepare(
      "INSERT INTO activity (counselor_id, student_id, kind, text) VALUES (?, ?, 'department_join', ?)"
    ).bind(invitedDepartment.counselorId, inserted.id, `${combinedName} joined department ${invitedDepartment.name}.`).run();
  }

  // Strict-mode email verification: do NOT issue a JWT here. The user must verify first.
  await ensureAuthSchema(c.env.DB);
  const verifyToken = generateOpaqueToken();
  const verifyHash = await hashOpaqueToken(verifyToken);
  const verifyExpires = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  await c.env.DB.prepare(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(inserted.id, verifyHash, verifyExpires).run();

  const verifyUrl = `${c.env.FRONTEND_ORIGIN}/verify-email?token=${verifyToken}`;
  let emailDelivered = true;
  let testModeBlocked = false;
  try {
    const tpl = verificationEmail({ name: combinedName, verifyUrl });
    const sendRes = await sendEmail(c.env, { to: body.email.toLowerCase(), ...tpl });
    if (!sendRes.ok) {
      emailDelivered = false;
      testModeBlocked = sendRes.testModeBlocked;
    }
  } catch (err) {
    console.error('[auth] signup verification email send failed', err);
    emailDelivered = false;
  }

  return c.json({
    verificationRequired: true,
    email: body.email.toLowerCase(),
    emailDelivered,
    // Fallback: when Resend is in test mode and rejected the recipient, return the
    // verify URL so the user (the one who just signed up in this same browser) can
    // still complete verification. In a real production setup with a verified Resend
    // domain, sendRes.ok will be true and verifyUrl is never returned.
    ...(testModeBlocked ? { verifyUrl } : {})
  });
});

app.post('/auth/signin', async c => {
  const ip = clientIp(c.req.raw.headers);
  const rl = await rateLimit(c.env.RATE_LIMITS, `signin:${ip}`, 10, 900);
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: 'Too many sign-in attempts. Try again in a few minutes.' }, 429);
  }
  const body = await c.req.json<{ email: string; password: string; role: 'student' | 'counselor' }>();
  if (!body.email || !body.password) return c.json({ error: 'Missing fields' }, 400);
  await ensureAuthSchema(c.env.DB);
  const u = await c.env.DB.prepare(
    'SELECT id, email, name, role, password_hash, password_salt, onboarded, email_verified FROM users WHERE email = ?'
  ).bind(body.email.toLowerCase()).first<{
    id: number; email: string; name: string; role: 'student' | 'counselor';
    password_hash: string; password_salt: string; onboarded: number; email_verified: number;
  }>();
  if (!u) return c.json({ error: 'Invalid email or password.' }, 401);
  if (u.role !== body.role) return c.json({ error: 'Invalid email or password.' }, 401);
  const ok = await verifyPassword(body.password, u.password_hash, u.password_salt);
  if (!ok) return c.json({ error: 'Invalid email or password.' }, 401);
  if (!u.email_verified) {
    return c.json({ error: 'Please verify your email to continue.', requiresVerification: true, email: u.email }, 403);
  }
  let basicsCompleted = false;
  if (u.role === 'student') {
    await ensureProfilesSchema(c.env.DB);
    const p = await c.env.DB.prepare('SELECT basics_completed FROM profiles WHERE user_id = ?').bind(u.id).first<{ basics_completed: number }>();
    basicsCompleted = !!(p && p.basics_completed);
  }
  const { accessToken, refreshToken } = await issueTokenPair(c.env, u);
  return c.json({
    token: accessToken,
    refreshToken,
    user: { id: u.id, email: u.email, name: u.name, role: u.role, onboarded: !!u.onboarded, basicsCompleted }
  });
});

app.put('/auth/password', auth, async c => {
  const id = c.get('userId');
  const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>();
  const current = (body.currentPassword || '').trim();
  const next = (body.newPassword || '').trim();
  if (!current || !next) return c.json({ error: 'Missing fields.' }, 400);
  if (next.length < 8) return c.json({ error: 'New password must be at least 8 characters.' }, 400);
  const u = await c.env.DB.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').bind(id).first<{ password_hash: string; password_salt: string }>();
  if (!u) return c.json({ error: 'Not found' }, 404);
  const ok = await verifyPassword(current, u.password_hash, u.password_salt);
  if (!ok) return c.json({ error: 'Current password is incorrect.' }, 401);
  const { hash, salt } = await hashPassword(next);
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, id).run();
  return c.json({ ok: true });
});

app.post('/auth/forgot-password', async c => {
  const ip = clientIp(c.req.raw.headers);
  const rl = await rateLimit(c.env.RATE_LIMITS, `forgot:${ip}`, 5, 3600);
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: 'Too many requests. Try again later.' }, 429);
  }
  const body = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
  const email = (body.email || '').trim().toLowerCase();
  // Always return ok — never reveal whether the email exists.
  if (!email) return c.json({ ok: true });

  await ensureAuthSchema(c.env.DB);
  const u = await c.env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first<{ id: number; name: string }>();
  if (!u) return c.json({ ok: true });

  const token = generateOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  await c.env.DB.prepare(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(u.id, tokenHash, expiresAt).run();

  const resetUrl = `${c.env.FRONTEND_ORIGIN}/reset-password?token=${token}`;
  let testModeBlocked = false;
  try {
    const tpl = passwordResetEmail({ name: u.name, resetUrl });
    const sendRes = await sendEmail(c.env, { to: email, ...tpl });
    if (!sendRes.ok) testModeBlocked = sendRes.testModeBlocked;
  } catch (err) {
    console.error('[auth] forgot-password email send failed', err);
  }
  return c.json({ ok: true, ...(testModeBlocked ? { resetUrl } : {}) });
});

app.post('/auth/reset-password', async c => {
  const ip = clientIp(c.req.raw.headers);
  const rl = await rateLimit(c.env.RATE_LIMITS, `reset:${ip}`, 10, 3600);
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: 'Too many requests. Try again later.' }, 429);
  }
  const body = await c.req.json<{ token?: string; newPassword?: string }>().catch(() => ({} as { token?: string; newPassword?: string }));
  const token = (body.token || '').trim();
  const newPassword = (body.newPassword || '').trim();
  if (!token || !newPassword) return c.json({ error: 'Missing fields.' }, 400);
  if (newPassword.length < 8) return c.json({ error: 'Password must be at least 8 characters.' }, 400);
  if (!isStrongPassword(newPassword)) {
    return c.json({ error: 'Password must include uppercase, lowercase, number, and special character.' }, 400);
  }

  await ensureAuthSchema(c.env.DB);
  const tokenHash = await hashOpaqueToken(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await c.env.DB.prepare(
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?'
  ).bind(tokenHash).first<{ id: number; user_id: number; expires_at: number; used_at: number | null }>();
  if (!row || row.used_at || row.expires_at < now) {
    return c.json({ error: 'This reset link is invalid or has expired.' }, 400);
  }

  const { hash, salt } = await hashPassword(newPassword);
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, row.user_id).run();
  await c.env.DB.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').bind(now, row.id).run();
  return c.json({ ok: true });
});

app.post('/auth/verify-email', async c => {
  const ip = clientIp(c.req.raw.headers);
  const rl = await rateLimit(c.env.RATE_LIMITS, `verify:${ip}`, 20, 3600);
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: 'Too many requests. Try again later.' }, 429);
  }
  const body = await c.req.json<{ token?: string }>().catch(() => ({} as { token?: string }));
  const token = (body.token || '').trim();
  if (!token) return c.json({ error: 'Missing token.' }, 400);

  await ensureAuthSchema(c.env.DB);
  const tokenHash = await hashOpaqueToken(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await c.env.DB.prepare(
    'SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ?'
  ).bind(tokenHash).first<{ id: number; user_id: number; expires_at: number; used_at: number | null }>();
  if (!row || row.used_at || row.expires_at < now) {
    return c.json({ error: 'This verification link is invalid or has expired.' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(row.user_id).run();
  await c.env.DB.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ?').bind(now, row.id).run();

  // Issue JWT so user is signed in immediately after verification.
  const u = await c.env.DB.prepare(
    'SELECT id, email, name, role, onboarded FROM users WHERE id = ?'
  ).bind(row.user_id).first<{ id: number; email: string; name: string; role: 'student' | 'counselor'; onboarded: number }>();
  if (!u) return c.json({ error: 'Account not found.' }, 404);

  let basicsCompleted = false;
  if (u.role === 'student') {
    await ensureProfilesSchema(c.env.DB);
    const p = await c.env.DB.prepare('SELECT basics_completed FROM profiles WHERE user_id = ?').bind(u.id).first<{ basics_completed: number }>();
    basicsCompleted = !!(p && p.basics_completed);
  }
  const { accessToken, refreshToken } = await issueTokenPair(c.env, u);
  return c.json({
    token: accessToken,
    refreshToken,
    user: { id: u.id, email: u.email, name: u.name, role: u.role, onboarded: !!u.onboarded, basicsCompleted }
  });
});

app.post('/auth/resend-verification', async c => {
  const ip = clientIp(c.req.raw.headers);
  const rl = await rateLimit(c.env.RATE_LIMITS, `resend:${ip}`, 5, 3600);
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: 'Too many requests. Try again later.' }, 429);
  }
  const body = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
  const email = (body.email || '').trim().toLowerCase();
  if (!email) return c.json({ ok: true });

  await ensureAuthSchema(c.env.DB);
  const u = await c.env.DB.prepare(
    'SELECT id, name, email_verified FROM users WHERE email = ?'
  ).bind(email).first<{ id: number; name: string; email_verified: number }>();
  // Always return ok; never reveal whether the email exists or is already verified.
  if (!u || u.email_verified) return c.json({ ok: true });

  const verifyToken = generateOpaqueToken();
  const verifyHash = await hashOpaqueToken(verifyToken);
  const verifyExpires = Math.floor(Date.now() / 1000) + 86400;
  await c.env.DB.prepare(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(u.id, verifyHash, verifyExpires).run();

  const verifyUrl = `${c.env.FRONTEND_ORIGIN}/verify-email?token=${verifyToken}`;
  let testModeBlocked = false;
  try {
    const tpl = verificationEmail({ name: u.name, verifyUrl });
    const sendRes = await sendEmail(c.env, { to: email, ...tpl });
    if (!sendRes.ok) testModeBlocked = sendRes.testModeBlocked;
  } catch (err) {
    console.error('[auth] resend verification email failed', err);
  }
  // Same test-mode fallback as signup. We only expose verifyUrl when Resend
  // explicitly blocked test-mode delivery — never on success or "user not found".
  return c.json({ ok: true, ...(testModeBlocked ? { verifyUrl } : {}) });
});

app.post('/auth/refresh', async c => {
  const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({} as { refreshToken?: string }));
  const raw = (body.refreshToken || '').trim();
  if (!raw) return c.json({ error: 'Missing refresh token.' }, 401);

  await ensureAuthSchema(c.env.DB);
  const hash = await hashOpaqueToken(raw);
  const now = Math.floor(Date.now() / 1000);
  const row = await c.env.DB.prepare(
    'SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?'
  ).bind(hash).first<{ id: number; user_id: number; expires_at: number; revoked_at: number | null }>();

  if (!row || row.revoked_at || row.expires_at < now) {
    return c.json({ error: 'Invalid or expired refresh token.' }, 401);
  }

  const u = await c.env.DB.prepare(
    'SELECT id, email, name, role FROM users WHERE id = ?'
  ).bind(row.user_id).first<{ id: number; email: string; name: string; role: 'student' | 'counselor' }>();
  if (!u) return c.json({ error: 'User not found.' }, 401);

  // Revoke old token (rotation: each use issues a new refresh token).
  await c.env.DB.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?').bind(now, row.id).run();

  const { accessToken, refreshToken } = await issueTokenPair(c.env, u);
  return c.json({ token: accessToken, refreshToken });
});

app.post('/auth/signout', auth, async c => {
  const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({} as { refreshToken?: string }));
  const raw = (body.refreshToken || '').trim();
  if (raw) {
    const hash = await hashOpaqueToken(raw);
    const now = Math.floor(Date.now() / 1000);
    await ensureAuthSchema(c.env.DB);
    await c.env.DB.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?').bind(now, hash).run();
  }
  return c.json({ ok: true });
});

app.get('/auth/me', auth, async c => {
  const id = c.get('userId');
  const u = await c.env.DB.prepare('SELECT id, email, name, role, onboarded, email_verified FROM users WHERE id = ?').bind(id).first<any>();
  if (!u) return c.json({ error: 'Not found' }, 404);
  let basicsCompleted = false;
  if (u.role === 'student') {
    await ensureProfilesSchema(c.env.DB);
    const p = await c.env.DB.prepare('SELECT basics_completed FROM profiles WHERE user_id = ?').bind(id).first<{ basics_completed: number }>();
    basicsCompleted = !!(p && p.basics_completed);
  }
  return c.json({ id: u.id, email: u.email, name: u.name, role: u.role, onboarded: !!u.onboarded, basicsCompleted, emailVerified: !!u.email_verified });
});

// -------- Student profile --------
app.get('/profile', auth, requireRole('student'), async c => {
  const id = c.get('userId');
  await ensureProfilesSchema(c.env.DB);
  const p = await c.env.DB.prepare(
    `SELECT strand, gwa, grades_json, school, grade_level, gender, birthdate,
            contact_number, guardian_name, basics_completed
     FROM profiles WHERE user_id = ?`
  ).bind(id).first<any>();
  if (!p) return c.json({});
  return c.json({
    strand: p.strand,
    gwa: p.gwa,
    grades: p.grades_json ? JSON.parse(p.grades_json) : {},
    school: p.school ?? null,
    gradeLevel: p.grade_level ?? null,
    gender: p.gender ?? null,
    birthdate: p.birthdate ?? null,
    contactNumber: p.contact_number ?? null,
    guardianName: p.guardian_name ?? null,
    basicsCompleted: !!p.basics_completed
  });
});

const ALLOWED_GENDERS = new Set(['female', 'male', 'non_binary', 'prefer_not_to_say']);
const ALLOWED_GRADE_LEVELS = new Set(['11', '12']);

app.put('/profile/basics', auth, requireRole('student'), async c => {
  const id = c.get('userId');
  await ensureProfilesSchema(c.env.DB);
  const body = await c.req.json<{
    school?: string;
    gradeLevel?: string;
    gender?: string;
    birthdate?: string;
  }>();

  const school = (body.school || '').trim();
  const gradeLevel = (body.gradeLevel || '').trim();
  const gender = (body.gender || '').trim();
  const birthdate = (body.birthdate || '').trim();

  if (!school) return c.json({ error: 'School is required.' }, 400);
  if (!ALLOWED_GRADE_LEVELS.has(gradeLevel)) return c.json({ error: 'Grade level must be 11 or 12.' }, 400);
  if (!ALLOWED_GENDERS.has(gender)) return c.json({ error: 'Pick a valid gender option.' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return c.json({ error: 'Birthdate must be YYYY-MM-DD.' }, 400);

  await c.env.DB.prepare(
    `INSERT INTO profiles (user_id, school, grade_level, gender, birthdate, basics_completed, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET
       school=excluded.school,
       grade_level=excluded.grade_level,
       gender=excluded.gender,
       birthdate=excluded.birthdate,
       basics_completed=1,
       updated_at=unixepoch()`
  ).bind(id, school, gradeLevel, gender, birthdate).run();

  return c.json({ ok: true });
});

app.put('/profile', auth, requireRole('student'), async c => {
  const id = c.get('userId');
  await ensureProfilesSchema(c.env.DB);
  const body = await c.req.json<{ strand?: string; gwa?: number | null; grades?: unknown }>();
  const current = await c.env.DB.prepare('SELECT strand FROM profiles WHERE user_id = ?').bind(id).first<{ strand?: string | null }>();
  const requestedStrand = normalizeStrand(body.strand);
  const lockedStrand = normalizeStrand(current?.strand ?? '');
  if (lockedStrand && requestedStrand && requestedStrand !== lockedStrand) {
    return c.json({ error: 'Strand is locked to your invitation strand and cannot be changed.' }, 400);
  }
  const strand = lockedStrand || requestedStrand;
  const gwa = normalizeGwa(body.gwa);
  const grades = normalizeGradeRecord(body.grades);

  if (!strand) return c.json({ error: 'Strand is required.' }, 400);
  if (!grades) {
    return c.json({ error: 'Provide Math, English, and Science grades for Grade 7, 8, 9, and 10 (0-100).' }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO profiles (user_id, strand, gwa, grades_json, updated_at) VALUES (?, ?, ?, ?, unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET strand=excluded.strand, gwa=excluded.gwa, grades_json=excluded.grades_json, updated_at=unixepoch()`
  ).bind(id, strand, gwa, JSON.stringify(grades)).run();
  await c.env.DB.prepare('UPDATE users SET onboarded = 1 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// -------- Assessments --------
async function loadAnswers(db: D1Database, table: string, userId: number): Promise<Record<number, number>> {
  const rs = await db.prepare(`SELECT question_id, value FROM ${table} WHERE user_id = ?`).bind(userId).all<any>();
  const out: Record<number, number> = {};
  for (const r of rs.results ?? []) out[r.question_id] = r.value;
  return out;
}

app.get('/assessment/riasec', auth, requireRole('student'), async c => {
  const answers = await loadAnswers(c.env.DB, 'riasec_answers', c.get('userId'));
  return c.json({ answers });
});
app.put('/assessment/riasec', auth, requireRole('student'), async c => {
  const { id, value } = await c.req.json<{ id: number; value: number }>();
  if (!id || value < 1 || value > 5) return c.json({ error: 'Invalid' }, 400);
  await c.env.DB.prepare(
    `INSERT INTO riasec_answers (user_id, question_id, value, updated_at) VALUES (?, ?, ?, unixepoch())
     ON CONFLICT(user_id, question_id) DO UPDATE SET value=excluded.value, updated_at=unixepoch()`
  ).bind(c.get('userId'), id, value).run();
  return c.json({ ok: true });
});
app.post('/assessment/riasec/submit', auth, requireRole('student'), async c => {
  const answers = await loadAnswers(c.env.DB, 'riasec_answers', c.get('userId'));
  if (!hasCompleteAnswers(answers, REQUIRED_RIASEC_COUNT)) {
    return c.json({ error: 'Please complete all 48 RIASEC items before submitting.' }, 400);
  }
  return c.json({ ok: true });
});

app.get('/assessment/scct', auth, requireRole('student'), async c => {
  const answers = await loadAnswers(c.env.DB, 'scct_answers', c.get('userId'));
  return c.json({ answers });
});
app.put('/assessment/scct', auth, requireRole('student'), async c => {
  const { id, value } = await c.req.json<{ id: number; value: number }>();
  if (!id || value < 1 || value > 5) return c.json({ error: 'Invalid' }, 400);
  await c.env.DB.prepare(
    `INSERT INTO scct_answers (user_id, question_id, value, updated_at) VALUES (?, ?, ?, unixepoch())
     ON CONFLICT(user_id, question_id) DO UPDATE SET value=excluded.value, updated_at=unixepoch()`
  ).bind(c.get('userId'), id, value).run();
  return c.json({ ok: true });
});
app.post('/assessment/scct/submit', auth, requireRole('student'), async c => {
  const userId = c.get('userId');
  const [riasec, scct, profile, user] = await Promise.all([
    loadAnswers(c.env.DB, 'riasec_answers', userId),
    loadAnswers(c.env.DB, 'scct_answers', userId),
    c.env.DB.prepare('SELECT strand, grades_json FROM profiles WHERE user_id = ?').bind(userId).first<{ strand?: string; grades_json?: string }>(),
    c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first<{ name: string }>()
  ]);

  if (!hasCompleteAnswers(riasec, REQUIRED_RIASEC_COUNT)) {
    return c.json({ error: 'Please complete all 48 RIASEC items before generating results.' }, 400);
  }
  if (!hasCompleteAnswers(scct, REQUIRED_SCCT_COUNT)) {
    return c.json({ error: 'Please complete all 12 SCCT items before generating results.' }, 400);
  }
  const normalizedProfileGrades = normalizeGradeRecord(profile?.grades_json ? JSON.parse(profile.grades_json) : null);
  if (!profile?.strand || !normalizedProfileGrades) {
    return c.json({ error: 'Complete onboarding profile (strand and Grade 7-10 subject grades) before results.' }, 400);
  }

  const riasecScores = scoreRiasec(riasec);
  const code = hollandCode(riasecScores);
  const scctScores = scoreScct(scct);
  const ml = predictFromDatasetMl({
    strand: profile.strand,
    grades: normalizedProfileGrades,
    riasecScores,
    scctScores
  });
  if (!ml) return c.json({ error: 'Could not compute dataset-aligned recommendations.' }, 500);

  await c.env.DB.prepare(
    `INSERT INTO results (user_id, riasec_json, scct_json, holland_code, courses_json, careers_json, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET riasec_json=excluded.riasec_json, scct_json=excluded.scct_json,
       holland_code=excluded.holland_code, courses_json=excluded.courses_json, careers_json=excluded.careers_json,
       generated_at=unixepoch()`
  ).bind(
    userId,
    JSON.stringify(riasecScores),
    JSON.stringify(scctScores),
    code,
    JSON.stringify(ml.courses),
    JSON.stringify(ml.careers)
  ).run();

  // Log activity for any counselors of departments this student belongs to.
  const mem = await c.env.DB.prepare(
    'SELECT d.counselor_id FROM department_members m JOIN departments d ON d.id = m.department_id WHERE m.student_id = ?'
  ).bind(userId).all<{ counselor_id: number }>();
  for (const row of mem.results ?? []) {
    await c.env.DB.prepare(
      "INSERT INTO activity (counselor_id, student_id, kind, text) VALUES (?, ?, 'result', ?)"
    ).bind(row.counselor_id, userId, `${user?.name ?? 'A student'} completed their assessment (${code}).`).run();
  }

  return c.json({ ok: true });
});

// -------- Results --------
app.get('/results', auth, requireRole('student'), async c => {
  const id = c.get('userId');
  let r = await c.env.DB.prepare(
    'SELECT riasec_json, scct_json, holland_code, courses_json, careers_json FROM results WHERE user_id = ?'
  ).bind(id).first<any>();

  // If not yet generated but answers exist, compute on the fly.
  if (!r) {
    const [riasec, scct, profile] = await Promise.all([
      loadAnswers(c.env.DB, 'riasec_answers', id),
      loadAnswers(c.env.DB, 'scct_answers', id),
      c.env.DB.prepare('SELECT strand, grades_json FROM profiles WHERE user_id = ?').bind(id).first<{ strand?: string; grades_json?: string }>()
    ]);
    if (!hasCompleteAnswers(riasec, REQUIRED_RIASEC_COUNT)) return c.json({ error: 'Complete all 48 RIASEC items first.' }, 400);
    if (!hasCompleteAnswers(scct, REQUIRED_SCCT_COUNT)) return c.json({ error: 'Complete all 12 SCCT items first.' }, 400);
    const normalizedProfileGrades = normalizeGradeRecord(profile?.grades_json ? JSON.parse(profile.grades_json) : null);
    if (!profile?.strand || !normalizedProfileGrades) {
      return c.json({ error: 'Complete onboarding profile before viewing results.' }, 400);
    }
    const rs = scoreRiasec(riasec);
    const sc = scoreScct(scct);
    const ml = predictFromDatasetMl({
      strand: profile.strand,
      grades: normalizedProfileGrades,
      riasecScores: rs,
      scctScores: sc
    });
    if (!ml) return c.json({ error: 'Could not compute dataset-aligned recommendations.' }, 500);
    r = {
      riasec_json: JSON.stringify(rs),
      scct_json: JSON.stringify(sc),
      holland_code: hollandCode(rs),
      courses_json: JSON.stringify(ml.courses),
      careers_json: JSON.stringify(ml.careers)
    };
  }

  return c.json({
    riasec: JSON.parse(r.riasec_json),
    scct: JSON.parse(r.scct_json),
    hollandCode: r.holland_code,
    courses: JSON.parse(r.courses_json),
    careers: JSON.parse(r.careers_json)
  });
});

// -------- AI explanation --------
app.post('/ai/explain', auth, requireRole('student'), async c => {
  const userId = c.get('userId');
  await ensureProfilesSchema(c.env.DB);
  const body = await c.req.json<{ question?: string }>();
  const question = (body.question || '').trim();
  if (!question) return c.json({ error: 'Question is required.' }, 400);
  if (question.length > 1000) return c.json({ error: 'Question is too long.' }, 400);

  const context = await buildStudentContext(c.env.DB, userId);
  if (!context) return c.json({ error: 'Student profile not found.' }, 404);
  if (context.assessmentStatus !== 'complete') {
    return c.json({ error: 'Generate your results first before using AI explanation.' }, 400);
  }

  const ruleBasedContext = {
    hollandCode: context.hollandCode ?? 'N/A',
    topCourse: context.topCourse ?? 'N/A',
    topCareer: context.topCareer ?? 'N/A',
    strand: context.strand,
    scct: {
      self_efficacy: context.selfEfficacy ?? 3,
      outcome_expectations: context.outcomeExpectation ?? 3,
      perceived_barriers: context.perceivedBarriers ?? 3,
    },
  };

  let reply = buildRuleBasedAiReply(question, ruleBasedContext);
  let source: 'rule_based' | 'ai' = 'rule_based';

  await ensureAiChatSchema(c.env.DB);
  c.executionCtx.waitUntil(ensureVectorizeSeed(c.env));
  try {
    const aiReply = await getExplainAiReply(c.env, question, context);
    if (aiReply) {
      reply = aiReply;
      source = 'ai';
    }
  } catch (e) {
    console.warn('Workers AI call failed, using fallback.', e);
  }

  return c.json({ reply, source });
});

// -------- AI Counselor sessions (student) --------
app.get('/ai/sessions', auth, requireRole('student'), async c => {
  const userId = c.get('userId');
  await ensureAiChatSchema(c.env.DB);
  const rs = await c.env.DB.prepare(`
    SELECT s.id, s.title, s.created_at AS createdAt, s.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM ai_chat_messages m WHERE m.session_id = s.id) AS messageCount
    FROM ai_chat_sessions s
    WHERE s.student_id = ?
    ORDER BY s.updated_at DESC
    LIMIT 30
  `).bind(userId).all<any>();
  return c.json(rs.results ?? []);
});

app.post('/ai/sessions', auth, requireRole('student'), async c => {
  const userId = c.get('userId');
  await ensureAiChatSchema(c.env.DB);
  const row = await c.env.DB.prepare(
    `INSERT INTO ai_chat_sessions (student_id) VALUES (?) RETURNING id, title, created_at AS createdAt, updated_at AS updatedAt`
  ).bind(userId).first<{ id: number; title: string; createdAt: number; updatedAt: number }>();
  return c.json(row);
});

app.delete('/ai/sessions/:id', auth, requireRole('student'), async c => {
  const userId = c.get('userId');
  const sessionId = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(sessionId)) return c.json({ error: 'Invalid session id.' }, 400);
  await ensureAiChatSchema(c.env.DB);
  const session = await c.env.DB.prepare(
    'SELECT id FROM ai_chat_sessions WHERE id = ? AND student_id = ?'
  ).bind(sessionId, userId).first();
  if (!session) return c.json({ error: 'Not found.' }, 404);
  await c.env.DB.prepare('DELETE FROM ai_chat_sessions WHERE id = ?').bind(sessionId).run();
  return c.json({ ok: true });
});

app.get('/ai/sessions/:id/messages', auth, requireRole('student'), async c => {
  const userId = c.get('userId');
  const sessionId = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(sessionId)) return c.json({ error: 'Invalid session id.' }, 400);
  await ensureAiChatSchema(c.env.DB);
  const session = await c.env.DB.prepare(
    'SELECT id FROM ai_chat_sessions WHERE id = ? AND student_id = ?'
  ).bind(sessionId, userId).first();
  if (!session) return c.json({ error: 'Not found.' }, 404);
  const rs = await c.env.DB.prepare(
    'SELECT id, role, content, created_at AS createdAt FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).bind(sessionId).all<any>();
  return c.json(rs.results ?? []);
});

app.post('/ai/sessions/:id/chat', auth, requireRole('student'), async c => {
  const userId = c.get('userId');
  const rl = await rateLimit(c.env.RATE_LIMITS, `aichat:${userId}`, 20, 3600);
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: 'You have hit the hourly chat limit. Try again later.' }, 429);
  }
  const sessionId = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(sessionId)) return c.json({ error: 'Invalid session id.' }, 400);
  await ensureAiChatSchema(c.env.DB);

  const session = await c.env.DB.prepare(
    'SELECT id, title FROM ai_chat_sessions WHERE id = ? AND student_id = ?'
  ).bind(sessionId, userId).first<{ id: number; title: string }>();
  if (!session) return c.json({ error: 'Not found.' }, 404);

  const body = await c.req.json<{ message?: string }>();
  const message = (body.message || '').trim();
  if (!message) return c.json({ error: 'Message is required.' }, 400);
  if (message.length > 2000) return c.json({ error: 'Message is too long.' }, 400);

  await c.env.DB.prepare(
    'INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, ?, ?)'
  ).bind(sessionId, 'user', message).run();

  if (session.title === 'New conversation') {
    const newTitle = message.slice(0, 60) + (message.length > 60 ? '…' : '');
    await c.env.DB.prepare(
      'UPDATE ai_chat_sessions SET title = ?, updated_at = unixepoch() WHERE id = ?'
    ).bind(newTitle, sessionId).run();
  } else {
    await c.env.DB.prepare(
      'UPDATE ai_chat_sessions SET updated_at = unixepoch() WHERE id = ?'
    ).bind(sessionId).run();
  }

  const historyRs = await c.env.DB.prepare(
    'SELECT role, content FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 11'
  ).bind(sessionId).all<{ role: string; content: string }>();
  const history = (historyRs.results ?? []).reverse().slice(0, -1);

  await ensureProfilesSchema(c.env.DB);
  const ctx = await buildStudentContext(c.env.DB, userId);
  if (!ctx) return c.json({ error: 'Student profile not found.' }, 404);

  c.executionCtx.waitUntil(ensureVectorizeSeed(c.env));
  let reply: string;
  let source: 'ai' | 'fallback' = 'fallback';

  const aiReply = await getCounselorAiReply(c.env, ctx, history, message).catch(() => null);
  if (aiReply) {
    reply = aiReply;
    source = 'ai';
  } else {
    reply = 'I want to keep this accurate, but I do not have enough matching reference knowledge for that question yet. Try asking about your RIASEC, SCCT interpretation, strand fit, course options, or career steps.';
  }

  await c.env.DB.prepare(
    'INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, ?, ?)'
  ).bind(sessionId, 'assistant', reply).run();

  const updatedTitle = session.title === 'New conversation'
    ? message.slice(0, 60) + (message.length > 60 ? '…' : '')
    : session.title;

  return c.json({ reply, source, sessionTitle: updatedTitle });
});

// -------- Admin: seed the Vectorize knowledge base --------
app.post('/admin/seed-knowledge', auth, requireRole('counselor'), async c => {
  const body = await c.req.json<{ urls?: string[] }>().catch(() => null);
  const sourceUrls = Array.isArray(body?.urls) ? body.urls : [];
  const result = await seedKnowledge(c.env, sourceUrls);
  return c.json({ ok: result.failedBatches === 0, ...result });
});

// -------- Counselor --------
app.get('/counselor/departments', auth, requireRole('counselor'), async c => {
  const id = c.get('userId');
  const origin = c.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  const rs = await c.env.DB.prepare(`
    SELECT d.id, d.name, d.strand, d.join_code AS joinCode,
      (SELECT COUNT(*) FROM department_members m WHERE m.department_id = d.id) AS students,
      (SELECT COUNT(*) FROM department_members m JOIN results r ON r.user_id = m.student_id WHERE m.department_id = d.id) AS completed
    FROM departments d WHERE counselor_id = ? ORDER BY created_at DESC
  `).bind(id).all<any>();
  const rows = (rs.results ?? []).map((r: any) => ({
    ...r,
    joinUrl: `${origin}/join/${r.joinCode}`
  }));
  return c.json(rows);
});

app.post('/counselor/departments', auth, requireRole('counselor'), async c => {
  const id = c.get('userId');
  const body = await c.req.json<{ name: string; strand: string }>();
  if (!body.name?.trim() || !body.strand) return c.json({ error: 'Missing fields' }, 400);
  let code = randomJoinCode();
  for (let i = 0; i < 5; i++) {
    const clash = await c.env.DB.prepare('SELECT id FROM departments WHERE join_code = ?').bind(code).first();
    if (!clash) break;
    code = randomJoinCode();
  }
  const inserted = await c.env.DB.prepare(
    'INSERT INTO departments (counselor_id, name, strand, join_code) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(id, body.name.trim(), body.strand, code).first<{ id: number }>();
  return c.json({ id: inserted?.id, name: body.name, strand: body.strand, joinCode: code, students: 0, completed: 0 });
});

app.get('/counselor/departments/:id', auth, requireRole('counselor'), async c => {
  const counselorId = c.get('userId');
  const deptId = parseInt(c.req.param('id'), 10);
  const d = await c.env.DB.prepare(
    'SELECT id, name, strand, join_code AS joinCode FROM departments WHERE id = ? AND counselor_id = ?'
  ).bind(deptId, counselorId).first<any>();
  if (!d) return c.json({ error: 'Not found' }, 404);

  const studentsRs = await c.env.DB.prepare(`
    SELECT u.id, u.name, u.email,
      CASE
        WHEN r.user_id IS NOT NULL THEN 'complete'
        WHEN EXISTS(SELECT 1 FROM riasec_answers a WHERE a.user_id = u.id) THEN 'in_progress'
        ELSE 'pending'
      END AS status,
      r.holland_code AS hollandCode,
      r.courses_json AS coursesJson,
      r.careers_json AS careersJson,
      r.scct_json AS scctJson,
      p.grades_json AS gradesJson
    FROM department_members m
    JOIN users u ON u.id = m.student_id
    LEFT JOIN results r ON r.user_id = u.id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE m.department_id = ?
    ORDER BY u.name
  `).bind(deptId).all<any>();

  const students = (studentsRs.results ?? []).map((row: any) => {
    let topCareer: string | null = null;
    let topCourse: string | null = null;
    let bestSubject: string | null = null;
    let selfEfficacy: number | null = null;
    let outcomeExpectation: number | null = null;
    let perceivedBarriers: number | null = null;
    try {
      const careers = row.careersJson ? JSON.parse(row.careersJson) : null;
      if (Array.isArray(careers) && careers[0]?.name) topCareer = careers[0].name;
    } catch {}
    try {
      const courses = row.coursesJson ? JSON.parse(row.coursesJson) : null;
      if (Array.isArray(courses) && courses[0]?.name) topCourse = courses[0].name;
    } catch {}
    try {
      const scct = row.scctJson ? JSON.parse(row.scctJson) : null;
      if (scct) {
        selfEfficacy = typeof scct.self_efficacy === 'number' ? scct.self_efficacy : null;
        outcomeExpectation = typeof scct.outcome_expectations === 'number' ? scct.outcome_expectations : null;
        perceivedBarriers = typeof scct.perceived_barriers === 'number' ? scct.perceived_barriers : null;
      }
    } catch {}
    try {
      const grades = row.gradesJson ? JSON.parse(row.gradesJson) : null;
      if (grades && typeof grades === 'object') {
        let max = -Infinity;
        for (const [subject, data] of Object.entries(grades)) {
          const avg = (data as any)?.average;
          if (typeof avg === 'number' && avg > max) {
            max = avg;
            bestSubject = subject;
          }
        }
      }
    } catch {}
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      hollandCode: row.hollandCode ?? null,
      topCareer,
      topCourse,
      bestSubject,
      selfEfficacy,
      outcomeExpectation,
      perceivedBarriers
    };
  });

  await ensureSeminarsSchema(c.env.DB);
  const seminars = await c.env.DB.prepare(`
    SELECT s.id, s.title, s.description, s.venue, s.scheduled_at AS scheduledAt,
      (SELECT COUNT(*) FROM seminar_invites i WHERE i.seminar_id = s.id) AS invited,
      (SELECT COUNT(*) FROM seminar_invites i WHERE i.seminar_id = s.id AND i.status = 'accepted') AS accepted,
      (SELECT COUNT(*) FROM seminar_invites i WHERE i.seminar_id = s.id AND i.status = 'declined') AS declined,
      (SELECT COUNT(*) FROM seminar_invites i WHERE i.seminar_id = s.id AND i.status = 'pending') AS pending
    FROM seminars s
    WHERE s.department_id = ?
    ORDER BY s.scheduled_at DESC, s.created_at DESC
  `).bind(deptId).all<any>();

  const origin = c.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  return c.json({
    id: d.id, name: d.name, strand: d.strand, joinCode: d.joinCode,
    joinUrl: `${origin}/join/${d.joinCode}`,
    students,
    seminars: seminars.results ?? []
  });
});

app.post('/counselor/departments/:id/seminars', auth, requireRole('counselor'), async c => {
  const counselorId = c.get('userId');
  const deptId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(deptId)) return c.json({ error: 'Invalid department id.' }, 400);

  await ensureSeminarsSchema(c.env.DB);

  const body = await c.req.json<{ title?: string; description?: string; venue?: string; scheduledAt?: number | string }>();
  const title = (body.title || '').trim();
  const description = (body.description || '').trim();
  const venue = (body.venue || '').trim();
  if (!title) return c.json({ error: 'Seminar title is required.' }, 400);

  let scheduledAt: number;
  if (typeof body.scheduledAt === 'number') {
    scheduledAt = Math.floor(body.scheduledAt);
  } else if (typeof body.scheduledAt === 'string') {
    const asDate = Date.parse(body.scheduledAt);
    if (Number.isNaN(asDate)) return c.json({ error: 'Invalid seminar schedule.' }, 400);
    scheduledAt = Math.floor(asDate / 1000);
  } else {
    return c.json({ error: 'Seminar schedule is required.' }, 400);
  }

  const dept = await c.env.DB.prepare(
    'SELECT id, name FROM departments WHERE id = ? AND counselor_id = ?'
  ).bind(deptId, counselorId).first<{ id: number; name: string }>();
  if (!dept) return c.json({ error: 'Department not found.' }, 404);

  const seminar = await c.env.DB.prepare(
    `INSERT INTO seminars (counselor_id, department_id, title, description, venue, scheduled_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, unixepoch()) RETURNING id`
  ).bind(counselorId, deptId, title, description || null, venue || null, scheduledAt).first<{ id: number }>();
  if (!seminar) return c.json({ error: 'Could not create seminar.' }, 500);

  const members = await c.env.DB.prepare(
    'SELECT student_id FROM department_members WHERE department_id = ?'
  ).bind(deptId).all<{ student_id: number }>();

  await ensureNotificationsSchema(c.env.DB);

  const scheduledDate = new Date(scheduledAt * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  let inviteCount = 0;
  for (const row of members.results ?? []) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO seminar_invites (seminar_id, department_id, student_id, status, created_at)
       VALUES (?, ?, ?, 'pending', unixepoch())`
    ).bind(seminar.id, deptId, row.student_id).run();

    const notifBody = `You have been invited to "${title}" on ${scheduledDate}${venue ? ` at ${venue}` : ''}.`;
    const notifRow = await c.env.DB.prepare(
      `INSERT INTO notifications (user_id, kind, title, body) VALUES (?, 'seminar_invite', ?, ?) RETURNING id, created_at`
    ).bind(row.student_id, `New event: ${title}`, notifBody).first<{ id: number; created_at: number }>();
    if (notifRow) {
      await pushNotification(c.env, row.student_id, {
        id: notifRow.id,
        kind: 'seminar_invite',
        title: `New event: ${title}`,
        body: notifBody,
        createdAt: notifRow.created_at,
      });
    }

    inviteCount++;
  }

  await c.env.DB.prepare(
    "INSERT INTO activity (counselor_id, kind, text) VALUES (?, 'seminar', ?)"
  ).bind(counselorId, `Seminar scheduled: ${title} for ${dept.name} (${inviteCount} invited).`).run();

  return c.json({
    id: seminar.id,
    title,
    description,
    scheduledAt,
    invited: inviteCount,
    accepted: 0,
    declined: 0,
    pending: inviteCount
  });
});

app.post('/counselor/events/ai-draft', auth, requireRole('counselor'), async c => {
  const userId = c.get('userId');
  const rl = await rateLimit(c.env.RATE_LIMITS, `aidraft:${userId}`, 10, 3600);
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: 'You have hit the hourly draft limit. Try again later.' }, 429);
  }
  const body = await c.req.json<{ prompt?: string }>().catch(() => ({} as { prompt?: string }));
  const prompt = (body.prompt || '').trim();
  if (!prompt) return c.json({ error: 'Prompt is required.' }, 400);
  if (prompt.length > 1000) return c.json({ error: 'Prompt too long.' }, 400);

  const nowIso = new Date().toISOString();
  const systemPrompt = [
    'You are an assistant that drafts school career-counseling events.',
    `The current date and time is ${nowIso}. Resolve relative dates (e.g. "next Friday 2pm") against this.`,
    'Output STRICT JSON ONLY — no prose, no code fences — with exactly these keys:',
    '  "title" (string, 4-80 chars, concise event name),',
    '  "description" (string, 1-2 sentences describing the event),',
    '  "venue" (string, short venue name; if unspecified, use "TBA"),',
    '  "scheduledAt" (string, ISO-8601 timestamp in the future).',
    'If the user prompt is missing a schedule, pick a reasonable business-hours slot within the next two weeks.',
    'Do not include any keys other than those four. Do not wrap in markdown.'
  ].join('\n');

  const raw = await runLlama(
    c.env,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    { temperature: 0.4, maxTokens: 300 }
  );

  if (!raw) return c.json({ error: 'AI service is unavailable. Please try again.' }, 502);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return c.json({ error: 'AI response could not be parsed.' }, 502);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return c.json({ error: 'AI response was not valid JSON.' }, 502);
  }

  const title = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
  const description = typeof parsed?.description === 'string' ? parsed.description.trim() : '';
  const venue = typeof parsed?.venue === 'string' ? parsed.venue.trim() : '';
  const scheduledAtRaw = typeof parsed?.scheduledAt === 'string' ? parsed.scheduledAt.trim() : '';

  if (!title) return c.json({ error: 'AI did not return a valid title.' }, 502);
  const scheduledMs = Date.parse(scheduledAtRaw);
  if (!Number.isFinite(scheduledMs)) {
    return c.json({ error: 'AI did not return a valid schedule.' }, 502);
  }

  return c.json({
    title: title.slice(0, 120),
    description: description.slice(0, 1000),
    venue: venue.slice(0, 120),
    scheduledAt: new Date(scheduledMs).toISOString()
  });
});

app.get('/counselor/profile', auth, requireRole('counselor'), async c => {
  const id = c.get('userId');
  await ensureProfilesSchema(c.env.DB);
  const [u, p] = await Promise.all([
    c.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(id).first<{ id: number; email: string; name: string }>(),
    c.env.DB.prepare('SELECT first_name, last_name, school FROM profiles WHERE user_id = ?').bind(id).first<{ first_name?: string; last_name?: string; school?: string }>()
  ]);
  if (!u) return c.json({ error: 'Not found' }, 404);
  return c.json({
    id: u.id,
    email: u.email,
    name: u.name,
    firstName: p?.first_name ?? '',
    lastName: p?.last_name ?? '',
    school: p?.school ?? ''
  });
});

app.put('/counselor/profile', auth, requireRole('counselor'), async c => {
  const id = c.get('userId');
  await ensureProfilesSchema(c.env.DB);
  const body = await c.req.json<{ firstName?: string; lastName?: string; school?: string }>();
  const firstName = (body.firstName || '').trim();
  const lastName = (body.lastName || '').trim();
  const school = (body.school || '').trim();
  if (!firstName || !lastName) return c.json({ error: 'First and last name are required.' }, 400);
  if (!school) return c.json({ error: 'School is required.' }, 400);

  const combinedName = `${firstName} ${lastName}`.trim();
  await c.env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(combinedName, id).run();
  await c.env.DB.prepare(
    `INSERT INTO profiles (user_id, first_name, last_name, school, updated_at)
     VALUES (?, ?, ?, ?, unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET
       first_name=excluded.first_name,
       last_name=excluded.last_name,
       school=excluded.school,
       updated_at=unixepoch()`
  ).bind(id, firstName, lastName, school).run();

  return c.json({ ok: true, name: combinedName, firstName, lastName, school });
});

app.delete('/counselor/departments/:deptId/students/:studentId', auth, requireRole('counselor'), async c => {
  const counselorId = c.get('userId');
  const deptId = Number.parseInt(c.req.param('deptId'), 10);
  const studentId = Number.parseInt(c.req.param('studentId'), 10);
  if (!Number.isFinite(deptId) || !Number.isFinite(studentId)) return c.json({ error: 'Invalid id.' }, 400);

  const dept = await c.env.DB.prepare(
    'SELECT id, name FROM departments WHERE id = ? AND counselor_id = ?'
  ).bind(deptId, counselorId).first<{ id: number; name: string }>();
  if (!dept) return c.json({ error: 'Department not found.' }, 404);

  const res = await c.env.DB.prepare(
    'DELETE FROM department_members WHERE department_id = ? AND student_id = ?'
  ).bind(deptId, studentId).run();

  const changes = Number((res as any)?.meta?.changes ?? 0);
  if (!changes) return c.json({ error: 'Student is not a member.' }, 404);

  const student = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(studentId).first<{ name: string }>();
  await c.env.DB.prepare(
    "INSERT INTO activity (counselor_id, student_id, kind, text) VALUES (?, ?, 'department_remove', ?)"
  ).bind(counselorId, studentId, `${student?.name ?? 'A student'} was removed from ${dept.name}.`).run();

  return c.json({ ok: true });
});

app.get('/counselor/seminars/:id', auth, requireRole('counselor'), async c => {
  const counselorId = c.get('userId');
  const seminarId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(seminarId)) return c.json({ error: 'Invalid id.' }, 400);
  await ensureSeminarsSchema(c.env.DB);

  const s = await c.env.DB.prepare(
    `SELECT s.id, s.title, s.description, s.venue, s.scheduled_at AS scheduledAt,
            d.id AS departmentId, d.name AS departmentName
     FROM seminars s
     JOIN departments d ON d.id = s.department_id
     WHERE s.id = ? AND s.counselor_id = ?`
  ).bind(seminarId, counselorId).first<any>();
  if (!s) return c.json({ error: 'Not found' }, 404);

  const invitesRs = await c.env.DB.prepare(
    `SELECT i.id, i.status, u.id AS studentId, u.name, u.email
     FROM seminar_invites i
     JOIN users u ON u.id = i.student_id
     WHERE i.seminar_id = ?
     ORDER BY u.name`
  ).bind(seminarId).all<any>();

  const invites = invitesRs.results ?? [];
  const accepted = invites.filter((x: any) => x.status === 'accepted');
  const declined = invites.filter((x: any) => x.status === 'declined');
  const pending = invites.filter((x: any) => x.status === 'pending');

  return c.json({
    id: s.id,
    title: s.title,
    description: s.description ?? '',
    venue: s.venue ?? '',
    scheduledAt: s.scheduledAt,
    department: { id: s.departmentId, name: s.departmentName },
    totals: {
      invited: invites.length,
      accepted: accepted.length,
      declined: declined.length,
      pending: pending.length
    },
    joined: accepted.map((r: any) => ({ id: r.studentId, name: r.name, email: r.email })),
    notJoining: declined.map((r: any) => ({ id: r.studentId, name: r.name, email: r.email })),
    pendingStudents: pending.map((r: any) => ({ id: r.studentId, name: r.name, email: r.email }))
  });
});

app.get('/counselor/stats', auth, requireRole('counselor'), async c => {
  const counselorId = c.get('userId');
  const now = Math.floor(Date.now() / 1000);
  const since = now - 30 * 86400;

  const [completionsRs, hollandRs, strandRs, totalsRs, predictionsRs] = await Promise.all([
    c.env.DB.prepare(
      `SELECT r.generated_at AS ts
       FROM results r
       JOIN department_members m ON m.student_id = r.user_id
       JOIN departments d ON d.id = m.department_id
       WHERE d.counselor_id = ? AND r.generated_at >= ?`
    ).bind(counselorId, since).all<{ ts: number }>(),
    c.env.DB.prepare(
      `SELECT r.holland_code AS code, COUNT(DISTINCT r.user_id) AS count
       FROM results r
       JOIN department_members m ON m.student_id = r.user_id
       JOIN departments d ON d.id = m.department_id
       WHERE d.counselor_id = ?
       GROUP BY r.holland_code
       ORDER BY count DESC
       LIMIT 12`
    ).bind(counselorId).all<{ code: string; count: number }>(),
    c.env.DB.prepare(
      `SELECT d.strand AS strand,
              COUNT(DISTINCT m.student_id) AS students,
              COUNT(DISTINCT r.user_id) AS completed
       FROM departments d
       LEFT JOIN department_members m ON m.department_id = d.id
       LEFT JOIN results r ON r.user_id = m.student_id
       WHERE d.counselor_id = ?
       GROUP BY d.strand`
    ).bind(counselorId).all<{ strand: string; students: number; completed: number }>(),
    c.env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM departments WHERE counselor_id = ?) AS departments,
         (SELECT COUNT(DISTINCT m.student_id)
            FROM department_members m
            JOIN departments d ON d.id = m.department_id
            WHERE d.counselor_id = ?) AS students,
         (SELECT COUNT(DISTINCT r.user_id)
            FROM results r
            JOIN department_members m ON m.student_id = r.user_id
            JOIN departments d ON d.id = m.department_id
            WHERE d.counselor_id = ?) AS completed`
    ).bind(counselorId, counselorId, counselorId).first<{ departments: number; students: number; completed: number }>(),
    c.env.DB.prepare(
      `SELECT DISTINCT r.user_id AS userId, r.courses_json AS coursesJson, r.careers_json AS careersJson
       FROM results r
       JOIN department_members m ON m.student_id = r.user_id
       JOIN departments d ON d.id = m.department_id
       WHERE d.counselor_id = ?`
    ).bind(counselorId).all<{ userId: number; coursesJson: string; careersJson: string }>()
  ]);

  // Bucket completions per day for last 30 days
  const dailyCounts: Record<string, number> = {};
  for (const row of completionsRs.results ?? []) {
    const day = new Date(row.ts * 1000).toISOString().slice(0, 10);
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  }
  const heatmap: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date((now - i * 86400) * 1000).toISOString().slice(0, 10);
    heatmap.push({ date: d, count: dailyCounts[d] || 0 });
  }

  // Tally top careers + courses (by student's #1 pick)
  const careerCounts: Record<string, number> = {};
  const courseCounts: Record<string, number> = {};
  for (const row of predictionsRs.results ?? []) {
    try {
      const careers = JSON.parse(row.careersJson) as Array<{ name: string }>;
      if (careers?.[0]?.name) careerCounts[careers[0].name] = (careerCounts[careers[0].name] || 0) + 1;
    } catch {}
    try {
      const courses = JSON.parse(row.coursesJson) as Array<{ name: string }>;
      if (courses?.[0]?.name) courseCounts[courses[0].name] = (courseCounts[courses[0].name] || 0) + 1;
    } catch {}
  }
  const topCareers = Object.entries(careerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
  const topCourses = Object.entries(courseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const holland = hollandRs.results ?? [];
  return c.json({
    totals: {
      ...(totalsRs ?? { departments: 0, students: 0, completed: 0 }),
      topHolland: holland[0]?.code ?? null,
      topCareer: topCareers[0]?.name ?? null,
      topCourse: topCourses[0]?.name ?? null
    },
    heatmap,
    holland,
    strands: strandRs.results ?? [],
    topCareers,
    topCourses
  });
});

app.get('/counselor/seminars', auth, requireRole('counselor'), async c => {
  const counselorId = c.get('userId');
  await ensureSeminarsSchema(c.env.DB);
  const rs = await c.env.DB.prepare(
    `SELECT s.id, s.title, s.description, s.venue, s.scheduled_at AS scheduledAt,
            d.id AS departmentId, d.name AS departmentName,
            (SELECT COUNT(*) FROM seminar_invites i WHERE i.seminar_id = s.id) AS invited,
            (SELECT COUNT(*) FROM seminar_invites i WHERE i.seminar_id = s.id AND i.status = 'accepted') AS accepted,
            (SELECT COUNT(*) FROM seminar_invites i WHERE i.seminar_id = s.id AND i.status = 'declined') AS declined,
            (SELECT COUNT(*) FROM seminar_invites i WHERE i.seminar_id = s.id AND i.status = 'pending') AS pending
     FROM seminars s
     JOIN departments d ON d.id = s.department_id
     WHERE s.counselor_id = ?
     ORDER BY s.scheduled_at ASC`
  ).bind(counselorId).all<any>();
  return c.json(rs.results ?? []);
});

app.get('/counselor/activity', auth, requireRole('counselor'), async c => {
  const id = c.get('userId');
  const rs = await c.env.DB.prepare(
    'SELECT id, text, created_at FROM activity WHERE counselor_id = ? ORDER BY created_at DESC LIMIT 25'
  ).bind(id).all<any>();
  const now = Math.floor(Date.now() / 1000);
  return c.json((rs.results ?? []).map((r: any) => ({
    id: r.id,
    text: r.text,
    ago: humanTime(now - r.created_at)
  })));
});

app.get('/counselor/students/:id/results', auth, requireRole('counselor'), async c => {
  const counselorId = c.get('userId');
  const studentId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(studentId)) return c.json({ error: 'Invalid student id.' }, 400);

  const allowed = await c.env.DB.prepare(
    `SELECT 1
     FROM department_members m
     JOIN departments d ON d.id = m.department_id
     WHERE d.counselor_id = ? AND m.student_id = ?
     LIMIT 1`
  ).bind(counselorId, studentId).first();
  if (!allowed) return c.json({ error: 'Not found' }, 404);

  const [student, profile, result] = await Promise.all([
    c.env.DB.prepare('SELECT id, name, email FROM users WHERE id = ? AND role = ?').bind(studentId, 'student').first<{ id: number; name: string; email: string }>(),
    c.env.DB.prepare(
      'SELECT strand, gwa, grades_json FROM profiles WHERE user_id = ?'
    ).bind(studentId).first<{
      strand?: string;
      gwa?: number;
      grades_json?: string;
    }>(),
    c.env.DB.prepare(
      'SELECT riasec_json, scct_json, holland_code, courses_json, careers_json, generated_at FROM results WHERE user_id = ?'
    ).bind(studentId).first<{
      riasec_json: string;
      scct_json: string;
      holland_code: string;
      courses_json: string;
      careers_json: string;
      generated_at: number;
    }>()
  ]);

  if (!student) return c.json({ error: 'Not found' }, 404);

  return c.json({
    student,
    profile: profile
      ? {
        strand: profile.strand ?? null,
        gwa: profile.gwa ?? null,
        grades: profile.grades_json ? JSON.parse(profile.grades_json) : null
      }
      : null,
    results: result
      ? {
        generatedAt: result.generated_at,
        hollandCode: result.holland_code,
        riasec: JSON.parse(result.riasec_json),
        scct: JSON.parse(result.scct_json),
        courses: JSON.parse(result.courses_json),
        careers: JSON.parse(result.careers_json)
      }
      : null
  });
});

function humanTime(secs: number) {
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// -------- Student: join a department via code --------
app.post('/join/:code', auth, requireRole('student'), async c => {
  const code = normalizeJoinCode(c.req.param('code'));
  const studentId = c.get('userId');
  if (!isValidJoinCode(code)) {
    return c.json({ error: 'Join code must be 6 characters using letters and numbers.' }, 400);
  }

  const d = await c.env.DB.prepare(
    'SELECT id, name, strand, counselor_id AS counselorId FROM departments WHERE join_code = ?'
  ).bind(code).first<{ id: number; name: string; strand: string; counselorId: number }>();
  if (!d) return c.json({ error: 'Invalid join code.' }, 404);

  const inserted = await c.env.DB.prepare(
    'INSERT OR IGNORE INTO department_members (department_id, student_id) VALUES (?, ?)'
  ).bind(d.id, studentId).run();

  await ensureProfilesSchema(c.env.DB);
  await c.env.DB.prepare(
    `INSERT INTO profiles (user_id, strand, updated_at)
     VALUES (?, ?, unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET
       strand=CASE
         WHEN profiles.strand IS NULL OR trim(profiles.strand) = '' THEN excluded.strand
         ELSE profiles.strand
       END,
       updated_at=unixepoch()`
  ).bind(studentId, d.strand).run();

  const joinedNow = Number((inserted as any)?.meta?.changes ?? 0) > 0;
  if (!joinedNow) {
    return c.json({ ok: true, departmentId: d.id, alreadyJoined: true });
  }

  const student = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(studentId).first<{ name: string }>();
  await c.env.DB.prepare(
    "INSERT INTO activity (counselor_id, student_id, kind, text) VALUES (?, ?, 'department_join', ?)"
  ).bind(d.counselorId, studentId, `${student?.name ?? 'A student'} joined department ${d.name}.`).run();

  return c.json({ ok: true, departmentId: d.id, alreadyJoined: false });
});

app.get('/student/departments', auth, requireRole('student'), async c => {
  const studentId = c.get('userId');
  const rs = await c.env.DB.prepare(`
    SELECT d.id, d.name, d.strand, d.join_code AS joinCode,
      u.name AS counselorName,
      (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id) AS students,
      (SELECT COUNT(*) FROM department_members dm JOIN results r ON r.user_id = dm.student_id WHERE dm.department_id = d.id) AS completed
    FROM department_members m
    JOIN departments d ON d.id = m.department_id
    JOIN users u ON u.id = d.counselor_id
    WHERE m.student_id = ?
    ORDER BY d.created_at DESC
  `).bind(studentId).all<any>();

  const departments = rs.results ?? [];
  if (departments.length === 0) return c.json([]);

  const deptIds = departments.map((d: any) => d.id);
  const placeholders = deptIds.map(() => '?').join(',');
  const membersRs = await c.env.DB.prepare(`
    SELECT m.department_id AS departmentId, u.id, u.name,
      r.courses_json AS coursesJson,
      r.careers_json AS careersJson
    FROM department_members m
    JOIN users u ON u.id = m.student_id
    LEFT JOIN results r ON r.user_id = u.id
    WHERE m.department_id IN (${placeholders})
    ORDER BY u.name
  `).bind(...deptIds).all<any>();

  const membersByDept: Record<number, any[]> = {};
  for (const row of membersRs.results ?? []) {
    let topCareer: string | null = null;
    let topCourse: string | null = null;
    try {
      const careers = row.careersJson ? JSON.parse(row.careersJson) : null;
      if (Array.isArray(careers) && careers[0]?.name) topCareer = careers[0].name;
    } catch {}
    try {
      const courses = row.coursesJson ? JSON.parse(row.coursesJson) : null;
      if (Array.isArray(courses) && courses[0]?.name) topCourse = courses[0].name;
    } catch {}
    (membersByDept[row.departmentId] ||= []).push({
      id: row.id,
      name: row.name,
      topCareer,
      topCourse
    });
  }

  const withMembers = departments.map((d: any) => ({
    ...d,
    members: membersByDept[d.id] ?? []
  }));

  return c.json(withMembers);
});

app.get('/student/invitations', auth, requireRole('student'), async c => {
  const studentId = c.get('userId');
  const rs = await c.env.DB.prepare(`
    SELECT i.id, i.status,
      s.title, s.description, s.scheduled_at AS scheduledAt,
      d.name AS departmentName
    FROM seminar_invites i
    JOIN seminars s ON s.id = i.seminar_id
    JOIN departments d ON d.id = i.department_id
    WHERE i.student_id = ?
    ORDER BY s.scheduled_at ASC
    LIMIT 50
  `).bind(studentId).all<any>();

  return c.json(rs.results ?? []);
});

app.post('/student/invitations/:id/respond', auth, requireRole('student'), async c => {
  const studentId = c.get('userId');
  const inviteId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(inviteId)) return c.json({ error: 'Invalid invitation id.' }, 400);

  const body = await c.req.json<{ status?: 'accepted' | 'declined' }>();
  if (body.status !== 'accepted' && body.status !== 'declined') {
    return c.json({ error: 'Status must be accepted or declined.' }, 400);
  }

  const invite = await c.env.DB.prepare(
    `SELECT i.id, s.title, d.counselor_id AS counselorId
     FROM seminar_invites i
     JOIN seminars s ON s.id = i.seminar_id
     JOIN departments d ON d.id = i.department_id
     WHERE i.id = ? AND i.student_id = ?`
  ).bind(inviteId, studentId).first<{ id: number; title: string; counselorId: number }>();
  if (!invite) return c.json({ error: 'Invitation not found.' }, 404);

  await c.env.DB.prepare(
    'UPDATE seminar_invites SET status = ?, responded_at = unixepoch() WHERE id = ? AND student_id = ?'
  ).bind(body.status, inviteId, studentId).run();

  const student = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(studentId).first<{ name: string }>();
  const action = body.status === 'accepted' ? 'accepted' : 'declined';
  const studentName = student?.name ?? 'A student';
  await c.env.DB.prepare(
    "INSERT INTO activity (counselor_id, student_id, kind, text) VALUES (?, ?, 'seminar_response', ?)"
  ).bind(invite.counselorId, studentId, `${studentName} ${action} seminar invite: ${invite.title}.`).run();

  await ensureNotificationsSchema(c.env.DB);
  const notifTitle = `${studentName} ${action} your invitation`;
  const notifBody = `${studentName} has ${action} the invitation to "${invite.title}".`;
  const notifRow = await c.env.DB.prepare(
    `INSERT INTO notifications (user_id, kind, title, body) VALUES (?, 'seminar_response', ?, ?) RETURNING id, created_at`
  ).bind(invite.counselorId, notifTitle, notifBody).first<{ id: number; created_at: number }>();
  if (notifRow) {
    await pushNotification(c.env, invite.counselorId, {
      id: notifRow.id,
      kind: 'seminar_response',
      title: notifTitle,
      body: notifBody,
      createdAt: notifRow.created_at,
    });
  }

  return c.json({ ok: true });
});

// WebSocket upgrade — connects client to their notification Durable Object.
app.get('/ws/notifications', async c => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade.' }, 426);
  }
  const token = new URL(c.req.url).searchParams.get('token');
  if (!token) return c.json({ error: 'Missing token.' }, 401);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Invalid token.' }, 401);

  const stub = c.env.NOTIFICATIONS.get(c.env.NOTIFICATIONS.idFromName(payload.sub));
  const doUrl = new URL(c.req.url);
  doUrl.pathname = '/connect';
  return stub.fetch(new Request(doUrl.toString(), c.req.raw));
});

app.get('/notifications', auth, async c => {
  const userId = c.get('userId');
  await ensureNotificationsSchema(c.env.DB);
  const [countRow, rows] = await Promise.all([
    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).bind(userId).first<{ count: number }>(),
    c.env.DB.prepare(
      'SELECT id, kind, title, body, read, created_at as createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30'
    ).bind(userId).all<{ id: number; kind: string; title: string; body: string; read: number; createdAt: number }>()
  ]);
  return c.json({ unread: countRow?.count ?? 0, notifications: rows.results ?? [] });
});

app.post('/notifications/read-all', auth, async c => {
  const userId = c.get('userId');
  await ensureNotificationsSchema(c.env.DB);
  await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(userId).run();
  return c.json({ ok: true });
});

// 404 for unmatched API routes; serve frontend SPA for non-API GET/HEAD.
app.notFound(async c => {
  const method = c.req.method.toUpperCase();
  const pathname = new URL(c.req.url).pathname;

  if ((method === 'GET' || method === 'HEAD') && !isApiRoute(pathname)) {
    const assetRes = await c.env.ASSETS.fetch(c.req.raw);
    if (assetRes.status !== 404) return assetRes;

    const indexUrl = new URL(c.req.url);
    indexUrl.pathname = '/index.html';
    return c.env.ASSETS.fetch(new Request(indexUrl.toString(), c.req.raw));
  }

  return c.json({ error: 'Not found' }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Server error' }, 500);
});

export { NotificationDO } from './notificationDO';
export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const missing = validateEnv(env);
    if (missing.length > 0) {
      console.error(`[startup] Missing required env vars: ${missing.join(', ')}`);
      return new Response(
        JSON.stringify({ error: 'Service misconfigured. Contact the administrator.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(seedKnowledge(env));
  }
};
