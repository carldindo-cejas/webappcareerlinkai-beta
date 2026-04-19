// CareerLinkAI predictor — TypeScript port of apps/predictor/auto_add_data.py.
// The 225k-row career_suggestion.csv is the exhaustive product of the scoring
// function below, so running this directly gives the same best_career / best_course
// as the Flask logistic-regression model trained on the CSV.

export type SubjectName = 'Math' | 'English' | 'Science';
export type StrandCode = 'STEM' | 'ABM' | 'HUMSS' | 'ICT' | 'HE';

type RiasecLetter = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export type CareerPrediction = {
  bestCareer: string;
  bestCourse: string;
  bestSubject: SubjectName;
  hollandCode: string;
  scctSe: number;
  scctOe: number;
  scctB: number;
  score: number;
};

type CareerOption = { career: string; course: string };

const CAREER_OPTIONS: CareerOption[] = [
  { career: 'Civil Engineer', course: 'BS Civil Engineering' },
  { career: 'Marketing Manager', course: 'BS Business Administration Major in Marketing' },
  { career: 'Software Engineer', course: 'BS Computer Science' },
  { career: 'Registered Nurse', course: 'BS Nursing' },
  { career: 'CPA Accountant', course: 'BS Accountancy' },
  { career: 'Psychometrician', course: 'BS Psychology' },
  { career: 'Data Scientist', course: 'BS Statistics' },
  { career: 'Architect', course: 'BS Architecture' },
  { career: 'Licensed Pharmacist', course: 'BS Pharmacy' },
  { career: 'Graphic Designer', course: 'BFA Multimedia Arts' },
  { career: 'Mechanical Engineer', course: 'BS Mechanical Engineering' },
  { career: 'Lawyer / Attorney', course: 'BA Political Science' },
  { career: 'IT Specialist', course: 'BS Information Technology' },
  { career: 'Medical Technologist', course: 'BS Medical Technology' },
  { career: 'Financial Analyst', course: 'BS Business Administration Major in Finance' },
  { career: 'News Journalist', course: 'BA Journalism' },
  { career: 'Electrical Engineer', course: 'BS Electrical Engineering' },
  { career: 'Executive Chef', course: 'BS Culinary Management' },
  { career: 'Veterinarian', course: 'Doctor of Veterinary Medicine' },
  { career: 'HR Manager', course: 'BSBA Human Resource Management' },
  { career: 'Aircraft Mechanic', course: 'BS Aircraft Maintenance Technology' },
  { career: 'Social Worker', course: 'BS Social Work' },
  { career: 'Cybersecurity Analyst', course: 'BS Cybersecurity' },
  { career: 'Microbiologist', course: 'BS Biology' },
  { career: 'Hotel Manager', course: 'BS Hospitality Management' },
  { career: 'Physical Therapist', course: 'BS Physical Therapy' },
  { career: 'Geodetic Engineer', course: 'BS Geodetic Engineering' },
  { career: 'Librarian', course: 'BS Library and Information Science' },
  { career: 'Environmental Planner', course: 'BS Environmental Science' },
  { career: 'Economist', course: 'BS Economics' },
  { career: 'Chemical Engineer', course: 'BS Chemical Engineering' },
  { career: 'Criminologist', course: 'BS Criminology' },
  { career: 'Interior Designer', course: 'BS Interior Design' },
  { career: 'Radiologic Technologist', course: 'BS Radiologic Technology' },
  { career: 'Customs Broker', course: 'BS Customs Administration' },
  { career: 'PR Specialist', course: 'BA Communication' },
  { career: 'Computer Engineer', course: 'BS Computer Engineering' },
  { career: 'Nutritionist-Dietitian', course: 'BS Nutrition and Dietetics' },
  { career: 'Flight Attendant', course: 'BS Tourism Management' },
  { career: 'Real Estate Broker', course: 'BS Real Estate Management' },
  { career: 'Industrial Engineer', course: 'BS Industrial Engineering' },
  { career: 'Agriculturist', course: 'BS Agriculture' },
  { career: 'Marine Biologist', course: 'BS Marine Biology' },
  { career: 'Systems Administrator', course: 'BS Information Systems' },
  { career: 'Occupational Therapist', course: 'BS Occupational Therapy' },
  { career: 'Game Developer', course: 'BS Entertainment & Multimedia Computing' },
  { career: 'Marine Engineer', course: 'BS Marine Engineering' },
  { career: 'Merchant Marine Officer', course: 'BS Marine Transportation' },
  { career: 'Geologist', course: 'BS Geology' },
  { career: 'Actuary', course: 'BS Mathematics' },
  { career: 'Software Tester', course: 'BS Computer Science' },
  { career: 'Preschool Teacher', course: 'Bachelor of Early Childhood Education' },
  { career: 'SPED Teacher', course: 'Bachelor of Special Needs Education' },
  { career: 'High School Teacher', course: 'Bachelor of Secondary Education' },
  { career: 'Mining Engineer', course: 'BS Mining Engineering' },
  { career: 'Petroleum Engineer', course: 'BS Petroleum Engineering' },
  { career: 'Forensic Investigator', course: 'BS Forensic Science' },
  { career: 'Bank Manager', course: 'BSBA Banking and Finance' },
  { career: 'Operations Manager', course: 'BSBA Operations Management' },
  { career: 'UI/UX Designer', course: 'BS Information Technology' },
  { career: 'App Developer', course: 'BS Computer Science' },
  { career: 'Radio/TV Broadcaster', course: 'BA Broadcasting' },
  { career: 'Fashion Designer', course: 'BS Fashion Design and Technology' },
  { career: 'Optometrist', course: 'Doctor of Optometry' },
  { career: 'Dentist', course: 'Doctor of Dental Medicine' },
  { career: 'Anthropologist', course: 'BA Anthropology' },
  { career: 'Sociologist', course: 'BA Sociology' },
  { career: 'Historian', course: 'BA History' },
  { career: 'Museum Curator', course: 'BA Art Studies' },
  { career: 'Diplomat', course: 'BA International Studies' },
  { career: 'English Instructor', course: 'BA English Language Studies' },
  { career: 'Philosophy Professor', course: 'BA Philosophy' },
  { career: 'Technical Writer', course: 'BA English' },
  { career: 'Biochemist', course: 'BS Biochemistry' },
  { career: 'Meteorologist', course: 'BS Meteorology' },
  { career: 'Astrophysicist', course: 'BS Applied Physics' },
  { career: 'Materials Engineer', course: 'BS Materials Engineering' },
  { career: 'Sanitary Engineer', course: 'BS Sanitary Engineering' },
  { career: 'Electronics Engineer', course: 'BS Electronics Engineering' },
  { career: 'Entrepreneur', course: 'BS Entrepreneurship' },
  { career: 'Digital Marketer', course: 'BSBA Marketing Management' },
  { career: 'E-Commerce Manager', course: 'BS Information Systems' },
  { career: 'Office Administrator', course: 'BS Office Administration' },
  { career: 'Event Coordinator', course: 'BS Tourism Management' },
  { career: 'Tour Guide', course: 'BS Tourism' },
  { career: 'Pastry Chef', course: 'BS Hospitality Management' },
  { career: 'Agribusiness Manager', course: 'BS Agribusiness' },
  { career: 'Forester', course: 'BS Forestry' },
  { career: 'Fisheries Technologist', course: 'BS Fisheries' },
  { career: 'Environmental Officer', course: 'BS Environmental Management' },
  { career: 'Database Manager', course: 'BS Information Technology' },
  { career: 'Cloud Architect', course: 'BS Computer Science' },
  { career: 'AI Researcher', course: 'BS Applied Mathematics' },
  { career: 'Quality Analyst', course: 'BS Industrial Engineering' },
  { career: 'Telecom Engineer', course: 'BS Electronics Engineering' },
  { career: 'Paralegal', course: 'BS Legal Management' },
  { career: 'Public Servant', course: 'BS Public Administration' },
  { career: 'Logistics Officer', course: 'BS Customs Administration' },
  { career: 'Sports Coach', course: 'BS Sports Science' },
  { career: 'Advertising Director', course: 'BFA Advertising Arts' }
];

const HOLLAND_POSITION_WEIGHTS: [number, number, number] = [3, 2, 1];
const RIASEC_LETTERS: RiasecLetter[] = ['R', 'I', 'A', 'S', 'E', 'C'];

function permutations3(letters: RiasecLetter[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < letters.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      if (j === i) continue;
      for (let k = 0; k < letters.length; k++) {
        if (k === i || k === j) continue;
        out.push(letters[i] + letters[j] + letters[k]);
      }
    }
  }
  return out;
}

const ALL_HOLLAND_CODES = permutations3(RIASEC_LETTERS);
const HOLLAND_CODE_INDEX: Record<string, number> = {};
ALL_HOLLAND_CODES.forEach((code, index) => { HOLLAND_CODE_INDEX[code] = index; });

const STRAND_KEYWORDS: Record<StrandCode, Set<string>> = {
  STEM: new Set([
    'engineer', 'doctor', 'nurse', 'pharmac', 'therap', 'scient', 'biology',
    'chem', 'physics', 'geolog', 'meteor', 'veter', 'agri', 'forensic', 'marine'
  ]),
  ABM: new Set([
    'manager', 'marketing', 'account', 'finance', 'econom', 'entrepreneur',
    'bank', 'business', 'operations', 'real estate', 'office admin',
    'logistics', 'customs', 'broker'
  ]),
  HUMSS: new Set([
    'lawyer', 'attorney', 'journal', 'social', 'teacher', 'instructor',
    'professor', 'writer', 'communication', 'broadcast', 'anthrop',
    'sociolog', 'history', 'philosophy', 'diplomat', 'public admin',
    'paralegal', 'criminolog'
  ]),
  ICT: new Set([
    'software', 'computer', 'information system', 'information technology',
    'cyber', 'systems', 'database', 'cloud', 'app', 'ui/ux', 'game',
    'ai', 'data', 'telecom'
  ]),
  HE: new Set([
    'chef', 'culinary', 'hospitality', 'tourism', 'tour guide',
    'flight attendant', 'hotel', 'event', 'pastry'
  ])
};

const STRAND_DEFAULT_SUBJECTS: Record<StrandCode, SubjectName[]> = {
  STEM: ['Math', 'Science'],
  ABM: ['Math', 'English'],
  HUMSS: ['English', 'Science'],
  ICT: ['Math', 'English'],
  HE: ['English', 'Science']
};

const RIASEC_BASE_PROFILES: Record<StrandCode, Record<RiasecLetter, number>> = {
  STEM: { R: 3, I: 3, A: 1, S: 1, E: 1, C: 2 },
  ABM: { R: 1, I: 1, A: 1, S: 2, E: 3, C: 3 },
  HUMSS: { R: 1, I: 2, A: 2, S: 3, E: 2, C: 1 },
  ICT: { R: 2, I: 3, A: 1, S: 1, E: 1, C: 2 },
  HE: { R: 1, I: 1, A: 2, S: 3, E: 2, C: 2 }
};

const SCCT_BASE_IDEALS: Record<StrandCode, { se: number; oe: number; b: number }> = {
  STEM: { se: 4, oe: 4, b: 2 },
  ABM: { se: 3, oe: 4, b: 3 },
  HUMSS: { se: 4, oe: 4, b: 3 },
  ICT: { se: 4, oe: 4, b: 2 },
  HE: { se: 3, oe: 4, b: 3 }
};

const FEATURE_WEIGHTS = {
  best_subject: 15,
  shs_strand: 20,
  holland_code: 50,
  scct_se: 5,
  scct_oe: 5,
  scct_b: 5
};

const PERSONAL_FIT_WEIGHT = 50;
const IN_DEMAND_BIAS_WEIGHT = 50;

const IN_DEMAND_COURSES = new Set<string>([
  'BS Information Technology',
  'BS Computer Science',
  'BS Information Systems',
  'BS Statistics',
  'BFA Multimedia Arts',
  'BS Nursing',
  'BS Biology',
  'BS Psychology',
  'BS Pharmacy',
  'BS Physical Therapy',
  'BS Occupational Therapy',
  'BS Radiologic Technology',
  'BS Civil Engineering',
  'BS Mechanical Engineering',
  'BS Electronics Engineering',
  'BS Industrial Engineering',
  'BS Computer Engineering',
  'BS Accountancy',
  'BS Business Administration Major in Marketing',
  'BS Business Administration Major in Finance',
  'BSBA Marketing Management',
  'BS Tourism Management',
  'BS Hospitality Management',
  'BS Legal Management'
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stableSeed(text: string): number {
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += (i + 1) * text.charCodeAt(i);
  }
  return total;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function containsKeyword(text: string, keyword: string): boolean {
  // Short keywords (<=3 chars, no spaces) use word-boundary match to avoid stray hits.
  if (keyword.length <= 3 && !keyword.includes(' ')) {
    const re = new RegExp(`\\b${escapeRegex(keyword)}\\b`);
    return re.test(text);
  }
  return text.includes(keyword);
}

function keywordHits(text: string, keywords: Set<string> | string[]): number {
  const iter = keywords instanceof Set ? Array.from(keywords) : keywords;
  let hits = 0;
  for (const k of iter) if (containsKeyword(text, k)) hits += 1;
  return hits;
}

function inferStrandAffinity(career: string, course: string): Record<StrandCode, number> {
  const text = `${career} ${course}`.toLowerCase();
  const scores: Record<StrandCode, number> = { STEM: 0, ABM: 0, HUMSS: 0, ICT: 0, HE: 0 };
  (Object.keys(STRAND_KEYWORDS) as StrandCode[]).forEach(strand => {
    scores[strand] = keywordHits(text, STRAND_KEYWORDS[strand]);
  });

  if (Math.max(...Object.values(scores)) === 0) {
    if (text.includes('ba ') || text.includes('bachelor of')) scores.HUMSS = 2;
    if (text.includes('bsba') || text.includes('business')) scores.ABM = 2;
    if (text.includes('it') || text.includes('computer')) scores.ICT = 2;
    if (Math.max(...Object.values(scores)) === 0) scores.STEM = 2;
  }

  const maxScore = Math.max(...Object.values(scores));
  const normalized: Record<StrandCode, number> = { STEM: 0, ABM: 0, HUMSS: 0, ICT: 0, HE: 0 };
  (Object.keys(scores) as StrandCode[]).forEach(strand => {
    normalized[strand] = maxScore ? scores[strand] / maxScore : 0;
  });
  return normalized;
}

function inferPrimaryStrand(affinity: Record<StrandCode, number>): StrandCode {
  const priority: Record<StrandCode, number> = { HE: 5, ICT: 4, STEM: 3, ABM: 2, HUMSS: 1 };
  let best: StrandCode = 'STEM';
  let bestKey: [number, number] = [-Infinity, -Infinity];
  (Object.keys(affinity) as StrandCode[]).forEach(strand => {
    const key: [number, number] = [affinity[strand], priority[strand]];
    if (key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
      bestKey = key;
      best = strand;
    }
  });
  return best;
}

function inferSubjectProfile(career: string, course: string, strand: StrandCode): Record<SubjectName, number> {
  const text = `${career} ${course}`.toLowerCase();
  const scores: Record<SubjectName, number> = { Math: 0, Science: 0, English: 0 };

  const mathKw = [
    'engineer', 'account', 'finance', 'econom', 'analyst', 'actuary',
    'statistics', 'mathematics', 'data', 'computer', 'cyber', 'systems', 'logistics'
  ];
  const scienceKw = [
    'nurse', 'medical', 'pharmac', 'biology', 'chemist', 'veter', 'therapy',
    'science', 'forensic', 'geology', 'meteor', 'agri', 'fisher'
  ];
  const englishKw = [
    'lawyer', 'attorney', 'journal', 'teacher', 'instructor', 'writer',
    'communication', 'broadcaster', 'diplomat', 'manager', 'director',
    'social', 'designer', 'tour'
  ];

  scores.Math += keywordHits(text, mathKw);
  scores.Science += keywordHits(text, scienceKw);
  scores.English += keywordHits(text, englishKw);

  for (const subject of STRAND_DEFAULT_SUBJECTS[strand]) scores[subject] += 1;

  let maxScore = Math.max(scores.Math, scores.Science, scores.English);
  if (maxScore === 0) {
    for (const subject of STRAND_DEFAULT_SUBJECTS[strand]) scores[subject] = 1;
    maxScore = 1;
  }

  return {
    Math: scores.Math / maxScore,
    Science: scores.Science / maxScore,
    English: scores.English / maxScore
  };
}

function inferRiasecProfile(career: string, course: string, strand: StrandCode): Record<RiasecLetter, number> {
  const text = `${career} ${course}`.toLowerCase();
  const profile = { ...RIASEC_BASE_PROFILES[strand] };

  if (keywordHits(text, ['designer', 'arts', 'fashion', 'multimedia', 'museum', 'advertising', 'ui/ux'])) profile.A += 2;
  if (keywordHits(text, ['social', 'teacher', 'coach', 'hr', 'communication', 'public', 'lawyer', 'nurse'])) profile.S += 2;
  if (keywordHits(text, ['manager', 'director', 'entrepreneur', 'marketing', 'bank', 'broker', 'finance'])) {
    profile.E += 2;
    profile.C += 1;
  }
  if (keywordHits(text, ['scient', 'analyst', 'research', 'biolog', 'chemist', 'forensic', 'data'])) profile.I += 2;
  if (keywordHits(text, ['engineer', 'mechanic', 'architect', 'marine', 'aircraft', 'industrial', 'telecom'])) profile.R += 2;
  if (keywordHits(text, ['account', 'administrator', 'librarian', 'office', 'customs', 'quality'])) profile.C += 2;

  (Object.keys(profile) as RiasecLetter[]).forEach(letter => {
    profile[letter] = Math.max(1, Math.min(profile[letter], 6));
  });
  return profile;
}

function inferPreferredHollandCodes(
  riasecProfile: Record<RiasecLetter, number>,
  seed: number
): { primary: string; preferred: Set<string> } {
  const orderedLetters = [...RIASEC_LETTERS].sort((a, b) => {
    const delta = riasecProfile[b] - riasecProfile[a];
    if (delta !== 0) return delta;
    return b < a ? 1 : b > a ? -1 : 0;
  });
  const primary = orderedLetters.slice(0, 3).join('');

  const idx = seed % ALL_HOLLAND_CODES.length;
  const altA = ALL_HOLLAND_CODES[idx];
  const altB = ALL_HOLLAND_CODES[(idx + 17) % ALL_HOLLAND_CODES.length];
  const altC = ALL_HOLLAND_CODES[(idx + 53) % ALL_HOLLAND_CODES.length];
  return { primary, preferred: new Set([primary, altA, altB, altC]) };
}

function computeSignatureHollandFit(seed: number, hollandCode: string): number {
  const index = HOLLAND_CODE_INDEX[hollandCode] ?? 0;
  return ((seed * 37 + index * 19) % 997) / 996;
}

function inferScctIdeal(career: string, course: string, strand: StrandCode): { se: number; oe: number; b: number } {
  const text = `${career} ${course}`.toLowerCase();
  const ideal = { ...SCCT_BASE_IDEALS[strand] };
  const seed = stableSeed(text);

  const licensedKw = [
    'engineer', 'lawyer', 'attorney', 'nurse', 'pharmac', 'doctor', 'dentist',
    'optometrist', 'therap', 'veter', 'architect', 'account', 'teacher', 'technologist'
  ];
  if (keywordHits(text, licensedKw)) {
    ideal.se = Math.min(5, ideal.se + 1);
    ideal.oe = Math.min(5, ideal.oe + 1);
    ideal.b = Math.max(1, ideal.b - 1);
  }
  if (keywordHits(text, ['manager', 'director', 'officer'])) {
    ideal.oe = Math.min(5, ideal.oe + 1);
  }

  ideal.se = clamp(ideal.se + ((seed % 3) - 1), 1, 5);
  ideal.oe = clamp(ideal.oe + ((Math.floor(seed / 3) % 3) - 1), 1, 5);
  ideal.b = clamp(ideal.b + ((Math.floor(seed / 9) % 3) - 1), 1, 5);
  return ideal;
}

type PreparedOption = {
  career: string;
  course: string;
  seed: number;
  strand: StrandCode;
  strandAffinity: Record<StrandCode, number>;
  subjectProfile: Record<SubjectName, number>;
  riasecProfile: Record<RiasecLetter, number>;
  primaryHollandCode: string;
  preferredHollandCodes: Set<string>;
  scctIdeal: { se: number; oe: number; b: number };
};

function buildAllOptions(): PreparedOption[] {
  return CAREER_OPTIONS.map(({ career, course }) => {
    const seed = stableSeed(`${career} ${course}`.toLowerCase());
    const strandAffinity = inferStrandAffinity(career, course);
    const strand = inferPrimaryStrand(strandAffinity);
    const riasecProfile = inferRiasecProfile(career, course, strand);
    const { primary, preferred } = inferPreferredHollandCodes(riasecProfile, seed);
    return {
      career, course, seed, strand, strandAffinity,
      subjectProfile: inferSubjectProfile(career, course, strand),
      riasecProfile,
      primaryHollandCode: primary,
      preferredHollandCodes: preferred,
      scctIdeal: inferScctIdeal(career, course, strand)
    };
  });
}

const ALL_CAREER_OPTIONS = buildAllOptions();

function computeHollandScore(
  hollandCode: string,
  riasecProfile: Record<RiasecLetter, number>,
  primaryHollandCode: string,
  preferredHollandCodes: Set<string>,
  seed: number
): number {
  let rawScore = 0;
  for (let i = 0; i < 3; i++) {
    const weight = HOLLAND_POSITION_WEIGHTS[i];
    const letter = hollandCode[i] as RiasecLetter;
    rawScore += weight * (riasecProfile[letter] ?? 0);
  }
  const maxProfile = Math.max(...Object.values(riasecProfile));
  const maxRaw = HOLLAND_POSITION_WEIGHTS.reduce((acc, w) => acc + w * maxProfile, 0);
  const baseFit = maxRaw ? rawScore / maxRaw : 0;

  let specializationFit: number;
  if (hollandCode === primaryHollandCode) specializationFit = 1.0;
  else if (preferredHollandCodes.has(hollandCode)) specializationFit = 0.92;
  else if (hollandCode.slice(0, 2) === primaryHollandCode.slice(0, 2)) specializationFit = 0.82;
  else if (hollandCode[0] === primaryHollandCode[0]) specializationFit = 0.72;
  else if (hollandCode[1] === primaryHollandCode[1]) specializationFit = 0.58;
  else specializationFit = 0.28;

  const signatureFit = computeSignatureHollandFit(seed, hollandCode);
  return 0.55 * baseFit + 0.30 * specializationFit + 0.15 * signatureFit;
}

function computeScctAxis(actual: number, ideal: number): number {
  return Math.max(0, 1 - Math.abs(actual - ideal) / 4);
}

function computeScctComponentScore(
  scctSe: number, scctOe: number, scctB: number,
  ideal: { se: number; oe: number; b: number }
): number {
  return (
    FEATURE_WEIGHTS.scct_se * computeScctAxis(scctSe, ideal.se) +
    FEATURE_WEIGHTS.scct_oe * computeScctAxis(scctOe, ideal.oe) +
    FEATURE_WEIGHTS.scct_b * computeScctAxis(scctB, ideal.b)
  );
}

function careerTotalScore(
  option: PreparedOption,
  bestSubject: SubjectName,
  shsStrand: StrandCode,
  hollandCode: string,
  scctSe: number, scctOe: number, scctB: number
): number {
  const subjectFit = option.subjectProfile[bestSubject];
  const strandFit = option.strandAffinity[shsStrand];
  const hollandFit = computeHollandScore(
    hollandCode, option.riasecProfile, option.primaryHollandCode,
    option.preferredHollandCodes, option.seed
  );
  const scctScore = computeScctComponentScore(scctSe, scctOe, scctB, option.scctIdeal);
  return (
    FEATURE_WEIGHTS.best_subject * subjectFit +
    FEATURE_WEIGHTS.shs_strand * strandFit +
    FEATURE_WEIGHTS.holland_code * hollandFit +
    scctScore
  );
}

function inDemandCourseFit(option: PreparedOption): number {
  return IN_DEMAND_COURSES.has(option.course) ? 1 : 0;
}

function blendedPredictionScore(
  option: PreparedOption,
  bestSubject: SubjectName,
  shsStrand: StrandCode,
  hollandCode: string,
  scctSe: number,
  scctOe: number,
  scctB: number
): number {
  // Personal score is 0..100; normalize before blending with 0/1 demand fit.
  const personalFit = careerTotalScore(
    option,
    bestSubject,
    shsStrand,
    hollandCode,
    scctSe,
    scctOe,
    scctB
  ) / 100;
  const demandFit = inDemandCourseFit(option);
  return PERSONAL_FIT_WEIGHT * personalFit + IN_DEMAND_BIAS_WEIGHT * demandFit;
}

function tieBreak(option: PreparedOption, hollandIndex: number, scctSe: number, scctOe: number, scctB: number): number {
  const value = option.seed + hollandIndex * 29 + scctSe * 11 + scctOe * 7 + scctB * 5;
  return (value % 1009) / 1008;
}

export function clampScct(value: number): number {
  const rounded = Math.floor(value + 0.5);
  return Math.max(1, Math.min(5, rounded));
}

export function topHollandCode(scores: Record<RiasecLetter, number>): string {
  const sorted = [...RIASEC_LETTERS].sort((a, b) => {
    const delta = (scores[b] ?? 0) - (scores[a] ?? 0);
    if (delta !== 0) return delta;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return sorted.slice(0, 3).join('');
}

export function predictCareer(input: {
  bestSubject: SubjectName;
  shsStrand: StrandCode;
  hollandCode: string;
  scctSe: number;
  scctOe: number;
  scctB: number;
}): CareerPrediction {
  const hollandIndex = HOLLAND_CODE_INDEX[input.hollandCode];
  if (hollandIndex === undefined) {
    throw new Error(`Invalid Holland code: ${input.hollandCode}`);
  }

  let best: PreparedOption | null = null;
  let bestKey: [number, number] = [-Infinity, -Infinity];
  let bestScore = 0;

  for (const option of ALL_CAREER_OPTIONS) {
    const score = blendedPredictionScore(
      option, input.bestSubject, input.shsStrand, input.hollandCode,
      input.scctSe, input.scctOe, input.scctB
    );
    const tb = tieBreak(option, hollandIndex, input.scctSe, input.scctOe, input.scctB);
    if (score > bestKey[0] || (score === bestKey[0] && tb > bestKey[1])) {
      best = option;
      bestKey = [score, tb];
      bestScore = score;
    }
  }

  if (!best) throw new Error('No career options available');

  return {
    bestCareer: best.career,
    bestCourse: best.course,
    bestSubject: input.bestSubject,
    hollandCode: input.hollandCode,
    scctSe: input.scctSe,
    scctOe: input.scctOe,
    scctB: input.scctB,
    score: bestScore
  };
}
