import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { hashPassword, randomJoinCode, signToken, verifyPassword, verifyToken } from './auth';
import { hollandCode, scoreRiasec, scoreScct } from './scoring';
import { predictFromDatasetMl } from './ml/predictor';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  FRONTEND_ORIGIN: string;
  OPENAI_API_KEY?: string;
};

type Variables = {
  userId: number;
  userRole: 'student' | 'counselor';
  userEmail: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const REQUIRED_RIASEC_COUNT = 48;
const REQUIRED_SCCT_COUNT = 12;
const SUBJECT_KEYS = ['Math', 'English', 'Science'] as const;
const GRADE_LEVELS = ['7', '8', '9', '10'] as const;
const JOIN_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;
const API_ROUTE_PREFIXES = [
  '/health',
  '/auth',
  '/profile',
  '/assessment',
  '/results',
  '/ai',
  '/counselor',
  '/join',
  '/student'
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

async function getExternalAiReply(apiKey: string, question: string, context: {
  hollandCode: string;
  topCourse: string;
  topCareer: string;
  strand: string | null;
  scct: Record<string, number>;
}): Promise<string | null> {
  const prompt = [
    'You are a career counselor assistant for senior high school students in the Philippines.',
    'Explain recommendations in plain, encouraging language, no markdown, and keep it under 180 words.',
    `Student Holland code: ${context.hollandCode}`,
    `Top course: ${context.topCourse}`,
    `Top career: ${context.topCareer}`,
    `Current strand: ${context.strand ?? 'N/A'}`,
    `SCCT: self-efficacy=${(context.scct.self_efficacy ?? 3).toFixed(1)}, outcome expectations=${(context.scct.outcome_expectations ?? 3).toFixed(1)}, perceived barriers=${(context.scct.perceived_barriers ?? 3).toFixed(1)}`,
    `Question: ${question}`
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    if (!res.ok) return null;
    const body = await res.json<any>();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return null;
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

app.use('*', (c, next) => {
  const origin = c.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  return cors({
    origin: [origin, 'http://localhost:5173'],
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

// -------- Auth routes --------
app.post('/auth/signup', async c => {
  const body = await c.req.json<{
    name?: string;
    firstName?: string;
    lastName?: string;
    school?: string;
    inviteCode?: string;
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

  const token = await signToken({ sub: String(inserted.id), role: body.role, email: body.email.toLowerCase() }, c.env.JWT_SECRET);
  return c.json({
    token,
    user: { id: inserted.id, email: body.email.toLowerCase(), name: combinedName, role: body.role, onboarded: false, basicsCompleted: false }
  });
});

app.post('/auth/signin', async c => {
  const body = await c.req.json<{ email: string; password: string; role: 'student' | 'counselor' }>();
  if (!body.email || !body.password) return c.json({ error: 'Missing fields' }, 400);
  const u = await c.env.DB.prepare(
    'SELECT id, email, name, role, password_hash, password_salt, onboarded FROM users WHERE email = ?'
  ).bind(body.email.toLowerCase()).first<{
    id: number; email: string; name: string; role: 'student' | 'counselor';
    password_hash: string; password_salt: string; onboarded: number;
  }>();
  if (!u) return c.json({ error: 'Invalid email or password.' }, 401);
  if (u.role !== body.role) return c.json({ error: `This email is registered as a ${u.role}.` }, 403);
  const ok = await verifyPassword(body.password, u.password_hash, u.password_salt);
  if (!ok) return c.json({ error: 'Invalid email or password.' }, 401);
  const token = await signToken({ sub: String(u.id), role: u.role, email: u.email }, c.env.JWT_SECRET);
  let basicsCompleted = false;
  if (u.role === 'student') {
    await ensureProfilesSchema(c.env.DB);
    const p = await c.env.DB.prepare('SELECT basics_completed FROM profiles WHERE user_id = ?').bind(u.id).first<{ basics_completed: number }>();
    basicsCompleted = !!(p && p.basics_completed);
  }
  return c.json({
    token,
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

app.get('/auth/me', auth, async c => {
  const id = c.get('userId');
  const u = await c.env.DB.prepare('SELECT id, email, name, role, onboarded FROM users WHERE id = ?').bind(id).first<any>();
  if (!u) return c.json({ error: 'Not found' }, 404);
  let basicsCompleted = false;
  if (u.role === 'student') {
    await ensureProfilesSchema(c.env.DB);
    const p = await c.env.DB.prepare('SELECT basics_completed FROM profiles WHERE user_id = ?').bind(id).first<{ basics_completed: number }>();
    basicsCompleted = !!(p && p.basics_completed);
  }
  return c.json({ id: u.id, email: u.email, name: u.name, role: u.role, onboarded: !!u.onboarded, basicsCompleted });
});

// -------- Student profile --------
app.get('/profile', auth, requireRole('student'), async c => {
  const id = c.get('userId');
  await ensureProfilesSchema(c.env.DB);
  const p = await c.env.DB.prepare(
    `SELECT strand, gwa, grades_json, school, grade_level, gender, birthdate,
            contact_number, guardian_name, ai_external_consent, ai_external_consent_at, basics_completed
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
    aiExternalConsent: !!p.ai_external_consent,
    aiExternalConsentAt: p.ai_external_consent_at ?? null,
    basicsCompleted: !!p.basics_completed
  });
});

app.get('/profile/ai-consent', auth, requireRole('student'), async c => {
  const id = c.get('userId');
  await ensureProfilesSchema(c.env.DB);
  const row = await c.env.DB.prepare(
    'SELECT ai_external_consent, ai_external_consent_at FROM profiles WHERE user_id = ?'
  ).bind(id).first<{ ai_external_consent?: number; ai_external_consent_at?: number | null }>();

  return c.json({
    enabled: !!row?.ai_external_consent,
    updatedAt: row?.ai_external_consent_at ?? null
  });
});

app.put('/profile/ai-consent', auth, requireRole('student'), async c => {
  const id = c.get('userId');
  await ensureProfilesSchema(c.env.DB);

  const body = await c.req.json<{ enabled?: boolean }>();
  if (typeof body.enabled !== 'boolean') {
    return c.json({ error: 'enabled must be true or false.' }, 400);
  }

  const enabled = body.enabled ? 1 : 0;
  await c.env.DB.prepare(
    `INSERT INTO profiles (user_id, ai_external_consent, ai_external_consent_at, updated_at)
     VALUES (?, ?, CASE WHEN ? = 1 THEN unixepoch() ELSE NULL END, unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET
       ai_external_consent=excluded.ai_external_consent,
       ai_external_consent_at=excluded.ai_external_consent_at,
       updated_at=unixepoch()`
  ).bind(id, enabled, enabled).run();

  const current = await c.env.DB.prepare(
    'SELECT ai_external_consent, ai_external_consent_at FROM profiles WHERE user_id = ?'
  ).bind(id).first<{ ai_external_consent: number; ai_external_consent_at: number | null }>();

  return c.json({
    ok: true,
    enabled: !!current?.ai_external_consent,
    updatedAt: current?.ai_external_consent_at ?? null
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

  const [result, profile] = await Promise.all([
    c.env.DB.prepare(
      'SELECT holland_code, courses_json, careers_json, scct_json FROM results WHERE user_id = ?'
    ).bind(userId).first<{ holland_code: string; courses_json: string; careers_json: string; scct_json: string }>(),
    c.env.DB.prepare(
      'SELECT strand, ai_external_consent FROM profiles WHERE user_id = ?'
    ).bind(userId).first<{ strand?: string; ai_external_consent?: number }>()
  ]);

  if (!result) return c.json({ error: 'Generate your results first before using AI explanation.' }, 400);

  const courses = JSON.parse(result.courses_json) as Array<{ name: string }>;
  const careers = JSON.parse(result.careers_json) as Array<{ name: string }>;
  const scct = JSON.parse(result.scct_json) as Record<string, number>;
  const context = {
    hollandCode: result.holland_code,
    topCourse: courses[0]?.name ?? 'N/A',
    topCareer: careers[0]?.name ?? 'N/A',
    strand: profile?.strand ?? null,
    scct
  };

  let reply = buildRuleBasedAiReply(question, context);
  let source: 'rule_based' | 'external_ai' = 'rule_based';
  const externalConsent = !!profile?.ai_external_consent;

  const apiKey = c.env.OPENAI_API_KEY;
  if (apiKey && externalConsent) {
    try {
      const external = await getExternalAiReply(apiKey, question, context);
      if (external) {
        reply = external;
        source = 'external_ai';
      }
    } catch (e) {
      console.warn('External AI call failed, using fallback.', e);
    }
  }

  return c.json({
    reply,
    source,
    externalAi: {
      consented: externalConsent,
      configured: !!apiKey,
      used: source === 'external_ai'
    }
  });
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

  let inviteCount = 0;
  for (const row of members.results ?? []) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO seminar_invites (seminar_id, department_id, student_id, status, created_at)
       VALUES (?, ?, ?, 'pending', unixepoch())`
    ).bind(seminar.id, deptId, row.student_id).run();
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
      'SELECT strand, gwa, grades_json, ai_external_consent, ai_external_consent_at FROM profiles WHERE user_id = ?'
    ).bind(studentId).first<{
      strand?: string;
      gwa?: number;
      grades_json?: string;
      ai_external_consent?: number;
      ai_external_consent_at?: number | null;
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
        grades: profile.grades_json ? JSON.parse(profile.grades_json) : null,
        aiExternalConsent: !!profile.ai_external_consent,
        aiExternalConsentAt: profile.ai_external_consent_at ?? null
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
  await c.env.DB.prepare(
    "INSERT INTO activity (counselor_id, student_id, kind, text) VALUES (?, ?, 'seminar_response', ?)"
  ).bind(invite.counselorId, studentId, `${student?.name ?? 'A student'} ${action} seminar invite: ${invite.title}.`).run();

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
  return c.json({ error: err.message || 'Server error' }, 500);
});

export default app;
