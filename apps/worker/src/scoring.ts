// RIASEC scoring + recommendation engine.
// The 48 items are grouped 8 per dimension, in the order R, I, A, S, E, C.

type Dim = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
const DIMS: Dim[] = ['R', 'I', 'A', 'S', 'E', 'C'];

export function scoreRiasec(answers: Record<number, number>): Record<Dim, number> {
  const totals = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const counts = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  for (const [idStr, value] of Object.entries(answers)) {
    const id = Number(idStr);
    const dimIdx = Math.floor((id - 1) / 8);
    if (dimIdx < 0 || dimIdx > 5) continue;
    const dim = DIMS[dimIdx];
    totals[dim] += value;
    counts[dim] += 1;
  }
  const avg = {} as Record<Dim, number>;
  for (const d of DIMS) avg[d] = counts[d] ? totals[d] / counts[d] : 0;
  return avg;
}

export function hollandCode(scores: Record<Dim, number>): string {
  return [...DIMS].sort((a, b) => scores[b] - scores[a]).slice(0, 3).join('');
}

export function scoreScct(answers: Record<number, number>): Record<string, number> {
  // 1-4 self_efficacy, 5-8 outcome_expectations, 9-12 perceived_barriers.
  const groups = {
    self_efficacy: [1, 2, 3, 4],
    outcome_expectations: [5, 6, 7, 8],
    perceived_barriers: [9, 10, 11, 12]
  };
  const out: Record<string, number> = {};
  for (const [k, ids] of Object.entries(groups)) {
    let total = 0, count = 0;
    for (const id of ids) {
      if (answers[id] !== undefined) { total += answers[id]; count++; }
    }
    out[k] = count ? total / count : 0;
  }
  return out;
}

// Course catalog mapped to Holland dimensions. Match = cosine-like fit with RIASEC.
const COURSES: { name: string; profile: Partial<Record<Dim, number>>; reason: string }[] = [
  { name: 'BS Computer Science', profile: { I: 5, R: 3, C: 3 }, reason: 'Strong analytical + building focus; rewards investigation and structured problem-solving.' },
  { name: 'BS Architecture', profile: { A: 5, I: 4, R: 3 }, reason: 'Pairs creative vision with technical and investigative thinking.' },
  { name: 'BS Industrial Design', profile: { A: 5, R: 3, I: 3 }, reason: 'Hands-on creative work that solves real user problems.' },
  { name: 'BS Psychology', profile: { S: 5, I: 4, A: 2 }, reason: 'Understanding people analytically while caring about their growth.' },
  { name: 'BS Business Administration', profile: { E: 5, C: 3, S: 3 }, reason: 'Leadership, persuasion, and organised execution in equal measure.' },
  { name: 'BS Accountancy', profile: { C: 5, I: 3, E: 2 }, reason: 'Precision with numbers and rule-driven systems.' },
  { name: 'BS Nursing', profile: { S: 5, R: 3, I: 3 }, reason: 'Helping others through careful, hands-on practice.' },
  { name: 'BS Mechanical Engineering', profile: { R: 5, I: 4, C: 3 }, reason: 'Designing and analysing physical systems.' },
  { name: 'BS Multimedia Arts', profile: { A: 5, E: 3, S: 2 }, reason: 'Storytelling across formats with a creative voice.' },
  { name: 'AB Political Science', profile: { S: 4, E: 4, I: 3 }, reason: 'Ideas, persuasion, and social systems.' }
];

const CAREERS: { name: string; profile: Partial<Record<Dim, number>>; note: string }[] = [
  { name: 'Software Engineer', profile: { I: 5, C: 3, R: 2 }, note: 'Builds and investigates systems day-to-day.' },
  { name: 'UX / Product Designer', profile: { A: 5, S: 3, I: 3 }, note: 'Creative problem-solving for real users.' },
  { name: 'Architect', profile: { A: 4, I: 4, R: 3 }, note: 'Shapes the built environment with both art and math.' },
  { name: 'Clinical Psychologist', profile: { S: 5, I: 4 }, note: 'Listens deeply and thinks analytically.' },
  { name: 'Entrepreneur / Founder', profile: { E: 5, A: 3, C: 3 }, note: 'Builds, persuades, and organises simultaneously.' },
  { name: 'Data Analyst', profile: { I: 5, C: 4 }, note: 'Finds patterns and presents them clearly.' },
  { name: 'Teacher / Educator', profile: { S: 5, A: 3, E: 3 }, note: 'Helps others grow and learn.' },
  { name: 'Mechanical Engineer', profile: { R: 5, I: 4, C: 3 }, note: 'Hands-on technical work on real machines.' },
  { name: 'Marketing Manager', profile: { E: 5, A: 4, S: 3 }, note: 'Tells stories that move markets.' },
  { name: 'Accountant / Auditor', profile: { C: 5, I: 3 }, note: 'Rigour and accuracy at scale.' }
];

function matchScore(scores: Record<Dim, number>, profile: Partial<Record<Dim, number>>): number {
  // Weighted dot product; normalised to a 0–100 readable "match".
  let num = 0;
  let maxNum = 0;
  for (const d of DIMS) {
    const w = profile[d] ?? 0;
    num += w * scores[d];
    maxNum += w * 5;
  }
  if (maxNum === 0) return 0;
  return Math.round((num / maxNum) * 100);
}

export function recommend(scores: Record<Dim, number>, strand?: string | null) {
  const strandBoost = (profile: Partial<Record<Dim, number>>) => {
    if (!strand) return 0;
    if (strand === 'STEM' && (profile.I || profile.R)) return 2;
    if (strand === 'ABM' && (profile.E || profile.C)) return 2;
    if (strand === 'HUMSS' && (profile.S || profile.A)) return 2;
    if (strand === 'ARTS' && profile.A) return 3;
    if (strand === 'TVL' && profile.R) return 2;
    return 0;
  };

  const courses = COURSES
    .map(c => ({ name: c.name, match: matchScore(scores, c.profile) + strandBoost(c.profile), reason: c.reason }))
    .sort((a, b) => b.match - a.match)
    .slice(0, 6)
    .map(c => ({ ...c, match: Math.min(99, c.match) }));

  const careers = CAREERS
    .map(c => ({ name: c.name, match: matchScore(scores, c.profile) + strandBoost(c.profile), note: c.note }))
    .sort((a, b) => b.match - a.match)
    .slice(0, 6)
    .map(c => ({ ...c, match: Math.min(99, c.match) }));

  return { courses, careers };
}
