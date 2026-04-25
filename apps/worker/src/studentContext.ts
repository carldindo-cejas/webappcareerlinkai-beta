export type StudentContext = {
  name: string;
  email: string;
  strand: string | null;
  gradeLevel: string | null;
  school: string | null;
  age: number | null;
  gwa: number | null;
  bestSubject: string | null;

  assessmentStatus: 'pending' | 'in_progress' | 'complete';
  progress: { riasec: number; scct: number };

  hollandCode?: string;
  topCareer?: string;
  topCourse?: string;
  selfEfficacy?: number;
  outcomeExpectation?: number;
  perceivedBarriers?: number;
};

const RIASEC_TOTAL = 48;
const SCCT_TOTAL = 12;

function ageFromBirthdate(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

function bestSubjectFromGrades(gradesJson: string | null | undefined): string | null {
  if (!gradesJson) return null;
  try {
    const parsed = JSON.parse(gradesJson) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const subjectTotals: Record<string, { sum: number; count: number }> = {};
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          const entry = subjectTotals[key] ?? { sum: 0, count: 0 };
          entry.sum += value;
          entry.count += 1;
          subjectTotals[key] = entry;
        } else if (value && typeof value === 'object') {
          walk(value);
        }
      }
    };
    walk(parsed);

    let best: { name: string; avg: number } | null = null;
    for (const [name, { sum, count }] of Object.entries(subjectTotals)) {
      if (!count) continue;
      const avg = sum / count;
      if (!best || avg > best.avg) best = { name, avg };
    }
    return best?.name ?? null;
  } catch {
    return null;
  }
}

function pickFirstName(scct: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = scct[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

export async function buildStudentContext(
  db: D1Database,
  userId: number
): Promise<StudentContext | null> {
  const userRow = await db
    .prepare(
      `SELECT u.name AS name, u.email AS email,
              p.strand AS strand, p.grade_level AS gradeLevel, p.school AS school,
              p.birthdate AS birthdate, p.gwa AS gwa, p.grades_json AS gradesJson
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = ?`
    )
    .bind(userId)
    .first<{
      name: string;
      email: string;
      strand: string | null;
      gradeLevel: string | null;
      school: string | null;
      birthdate: string | null;
      gwa: number | null;
      gradesJson: string | null;
    }>();

  if (!userRow) return null;

  const [resultRow, riasecCountRow, scctCountRow] = await Promise.all([
    db
      .prepare(
        'SELECT holland_code AS hollandCode, courses_json AS coursesJson, careers_json AS careersJson, scct_json AS scctJson FROM results WHERE user_id = ?'
      )
      .bind(userId)
      .first<{ hollandCode: string; coursesJson: string; careersJson: string; scctJson: string }>()
      .catch(() => null),
    db
      .prepare('SELECT COUNT(*) AS c FROM riasec_answers WHERE user_id = ?')
      .bind(userId)
      .first<{ c: number }>()
      .catch(() => null),
    db
      .prepare('SELECT COUNT(*) AS c FROM scct_answers WHERE user_id = ?')
      .bind(userId)
      .first<{ c: number }>()
      .catch(() => null),
  ]);

  const riasecAnswered = riasecCountRow?.c ?? 0;
  const scctAnswered = scctCountRow?.c ?? 0;

  const ctx: StudentContext = {
    name: userRow.name,
    email: userRow.email,
    strand: userRow.strand,
    gradeLevel: userRow.gradeLevel,
    school: userRow.school,
    age: ageFromBirthdate(userRow.birthdate),
    gwa: typeof userRow.gwa === 'number' ? userRow.gwa : null,
    bestSubject: bestSubjectFromGrades(userRow.gradesJson),
    assessmentStatus: resultRow
      ? 'complete'
      : riasecAnswered + scctAnswered > 0
      ? 'in_progress'
      : 'pending',
    progress: { riasec: riasecAnswered, scct: scctAnswered },
  };

  if (resultRow) {
    ctx.hollandCode = resultRow.hollandCode;
    try {
      const courses = JSON.parse(resultRow.coursesJson) as Array<{ name?: string }>;
      ctx.topCourse = courses?.[0]?.name;
    } catch {
      /* ignore */
    }
    try {
      const careers = JSON.parse(resultRow.careersJson) as Array<{ name?: string }>;
      ctx.topCareer = careers?.[0]?.name;
    } catch {
      /* ignore */
    }
    try {
      const scct = JSON.parse(resultRow.scctJson) as Record<string, unknown>;
      ctx.selfEfficacy = pickFirstName(scct, 'self_efficacy', 'selfEfficacy');
      ctx.outcomeExpectation = pickFirstName(scct, 'outcome_expectations', 'outcomeExpectations', 'outcomeExpectation');
      ctx.perceivedBarriers = pickFirstName(scct, 'perceived_barriers', 'perceivedBarriers');
    } catch {
      /* ignore */
    }
  }

  return ctx;
}

export function renderContextForPrompt(ctx: StudentContext): string {
  const lines: string[] = [];
  lines.push(`Name: ${ctx.name}`);
  if (ctx.strand) lines.push(`Strand: ${ctx.strand}`);
  if (ctx.gradeLevel) lines.push(`Grade level: ${ctx.gradeLevel}`);
  if (ctx.school) lines.push(`School: ${ctx.school}`);
  if (ctx.age !== null) lines.push(`Age: ${ctx.age}`);
  if (ctx.gwa !== null) lines.push(`GWA: ${ctx.gwa.toFixed(2)}`);
  if (ctx.bestSubject) lines.push(`Strongest subject: ${ctx.bestSubject}`);

  if (ctx.assessmentStatus === 'pending') {
    lines.push('Assessment status: has not started the RIASEC or SCCT assessment yet.');
  } else if (ctx.assessmentStatus === 'in_progress') {
    lines.push(
      `Assessment status: in progress — ${ctx.progress.riasec}/${RIASEC_TOTAL} RIASEC items and ${ctx.progress.scct}/${SCCT_TOTAL} SCCT items answered. Final results are not computed yet.`
    );
  } else {
    lines.push('Assessment status: complete.');
    if (ctx.hollandCode) lines.push(`Holland code: ${ctx.hollandCode}`);
    if (ctx.topCourse) lines.push(`Top recommended course: ${ctx.topCourse}`);
    if (ctx.topCareer) lines.push(`Top recommended career: ${ctx.topCareer}`);
    if (typeof ctx.selfEfficacy === 'number')
      lines.push(`SCCT self-efficacy: ${ctx.selfEfficacy.toFixed(2)} (1–5 scale)`);
    if (typeof ctx.outcomeExpectation === 'number')
      lines.push(`SCCT outcome expectations: ${ctx.outcomeExpectation.toFixed(2)} (1–5 scale)`);
    if (typeof ctx.perceivedBarriers === 'number')
      lines.push(`SCCT perceived barriers: ${ctx.perceivedBarriers.toFixed(2)} (1–5 scale)`);
  }

  return lines.join('\n');
}
