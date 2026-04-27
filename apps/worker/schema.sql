-- CareerLinkAI remote schema for Cloudflare D1.
-- Safe to rerun; uses IF NOT EXISTS and does not drop data.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'counselor')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS profiles (
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
  first_name TEXT,
  last_name TEXT,
  ai_external_consent INTEGER NOT NULL DEFAULT 0,
  ai_external_consent_at INTEGER,
  basics_completed INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Idempotent column adds for existing D1 deployments.
-- D1 ignores duplicate ALTERs only via try/catch in scripts; safe to leave commented.
-- ALTER TABLE profiles ADD COLUMN school TEXT;
-- ALTER TABLE profiles ADD COLUMN grade_level TEXT;
-- ALTER TABLE profiles ADD COLUMN gender TEXT;
-- ALTER TABLE profiles ADD COLUMN birthdate TEXT;
-- ALTER TABLE profiles ADD COLUMN contact_number TEXT;
-- ALTER TABLE profiles ADD COLUMN guardian_name TEXT;
-- ALTER TABLE profiles ADD COLUMN ai_external_consent INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE profiles ADD COLUMN ai_external_consent_at INTEGER;
-- ALTER TABLE profiles ADD COLUMN basics_completed INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS riasec_answers (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS scct_answers (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS results (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  riasec_json TEXT NOT NULL,
  scct_json TEXT NOT NULL,
  holland_code TEXT NOT NULL,
  courses_json TEXT NOT NULL,
  careers_json TEXT NOT NULL,
  generated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  counselor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  strand TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS department_members (
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (department_id, student_id)
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  counselor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS seminars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  counselor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  venue TEXT,
  scheduled_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS seminar_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seminar_id INTEGER NOT NULL REFERENCES seminars(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  responded_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (seminar_id, student_id)
);

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO schools (name) VALUES ('Calape National High School');

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_departments_counselor ON departments(counselor_id);
CREATE INDEX IF NOT EXISTS idx_departments_join_code ON departments(join_code);
CREATE INDEX IF NOT EXISTS idx_department_members_student ON department_members(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_counselor_created ON activity(counselor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seminars_department ON seminars(department_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_seminar_invites_student ON seminar_invites(student_id, status, created_at DESC);
