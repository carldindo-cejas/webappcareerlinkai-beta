import { hollandCode } from '../scoring';
import {
  BASE_TOP_COUNTS_BASE64,
  BASE_TOP_LABEL_IDS_BASE64,
  CLASS_IDS_BASE64,
  HOLLAND_CODES,
  LABELS,
  STRANDS,
  SUBJECTS,
  TOP_K
} from './predictorMap';

type ScctScores = {
  self_efficacy?: number;
  outcome_expectations?: number;
  perceived_barriers?: number;
};

type MlPredictInput = {
  strand?: string | null;
  grades?: Record<string, any> | null;
  riasecScores: Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number>;
  scctScores: ScctScores;
};

export type MlPrediction = {
  bestCareer: string;
  bestCourse: string;
  bestSubject: string;
  hollandCode: string;
  shsStrand: string;
  scct: { se: number; oe: number; b: number };
  courses: { name: string; match: number; reason: string }[];
  careers: { name: string; match: number; note: string }[];
};

const strandIndex = new Map(STRANDS.map((s, i) => [s, i]));
const subjectIndex = new Map(SUBJECTS.map((s, i) => [s, i]));
const hollandIndex = new Map(HOLLAND_CODES.map((s, i) => [s, i]));

function decodeClassIds(base64: string): Uint16Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Uint16Array(bytes.buffer);
}

const classIds = decodeClassIds(CLASS_IDS_BASE64);
const baseTopLabelIds = decodeClassIds(BASE_TOP_LABEL_IDS_BASE64);

function decodeBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const baseTopCounts = decodeBytes(BASE_TOP_COUNTS_BASE64);

function clampLikert(value: number): number {
  return Math.max(1, Math.min(5, Math.floor(value + 0.5)));
}

function pickNumeric(grades: Record<string, any> | null | undefined, keys: string[], fallback = 0): number {
  if (!grades) return fallback;
  for (const key of keys) {
    const value = grades[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveSubjectAverage(
  grades: Record<string, any> | null | undefined,
  subjectAliases: string[]
): number {
  if (!grades) return 0;

  for (const alias of subjectAliases) {
    const topLevel = asNumber(grades[alias]);
    if (topLevel !== null) return topLevel;
  }

  const subjectRecord = subjectAliases
    .map(alias => grades[alias])
    .find(value => value && typeof value === 'object' && !Array.isArray(value)) as Record<string, any> | undefined;

  if (subjectRecord) {
    const explicitAverage = asNumber(subjectRecord.average);
    if (explicitAverage !== null) return explicitAverage;

    const gradeValues: number[] = [];
    for (const level of ['7', '8', '9', '10']) {
      const v = asNumber(subjectRecord[level]);
      if (v !== null) gradeValues.push(v);
    }
    if (gradeValues.length > 0) return mean(gradeValues);
  }

  const flatGradeValues: number[] = [];
  for (const alias of subjectAliases) {
    for (const level of ['7', '8', '9', '10']) {
      const flatKeys = [
        `${alias}_${level}`,
        `${alias}-${level}`,
        `${alias}${level}`,
        `${alias.toLowerCase()}_${level}`,
        `${alias.toLowerCase()}-${level}`
      ];
      for (const key of flatKeys) {
        const value = asNumber(grades[key]);
        if (value !== null) flatGradeValues.push(value);
      }
    }
  }
  if (flatGradeValues.length > 0) return mean(flatGradeValues);

  return 0;
}

function computeBestSubject(grades: Record<string, any> | null | undefined): (typeof SUBJECTS)[number] {
  const math = resolveSubjectAverage(grades, ['Math', 'Mathematics', 'math', 'mathematics']);
  const science = resolveSubjectAverage(grades, ['Science', 'science']);
  const english = resolveSubjectAverage(grades, ['English', 'english']);

  if (math === 0 && science === 0 && english === 0) {
    // Final fallback for legacy profiles that only stored flat numeric keys.
    const legacyMath = pickNumeric(grades, ['Math', 'Mathematics', 'math', 'mathematics']);
    const legacyScience = pickNumeric(grades, ['Science', 'science']);
    const legacyEnglish = pickNumeric(grades, ['English', 'english']);
    const legacyScored: Array<{ subject: (typeof SUBJECTS)[number]; score: number; tie: number }> = [
      { subject: 'Math', score: legacyMath, tie: 0 },
      { subject: 'Science', score: legacyScience, tie: 1 },
      { subject: 'English', score: legacyEnglish, tie: 2 }
    ];
    legacyScored.sort((a, b) => b.score - a.score || a.tie - b.tie);
    return legacyScored[0].subject;
  }

  const scored: Array<{ subject: (typeof SUBJECTS)[number]; score: number; tie: number }> = [
    { subject: 'Math', score: math, tie: 0 },
    { subject: 'Science', score: science, tie: 1 },
    { subject: 'English', score: english, tie: 2 }
  ];

  scored.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return scored[0].subject;
}

function mapStrand(strand: string | null | undefined): (typeof STRANDS)[number] {
  const normalized = (strand || '').toUpperCase().trim();
  if (strandIndex.has(normalized as (typeof STRANDS)[number])) return normalized as (typeof STRANDS)[number];
  if (normalized === 'TVL') return 'ICT';
  if (normalized === 'ARTS') return 'HUMSS';
  if (normalized === 'GAS') return 'HUMSS';
  return 'STEM';
}

function toIndex(subject: (typeof SUBJECTS)[number], strand: (typeof STRANDS)[number], holland: string, se: number, oe: number, b: number): number | null {
  const s = subjectIndex.get(subject);
  const st = strandIndex.get(strand);
  const h = hollandIndex.get(holland as (typeof HOLLAND_CODES)[number]);
  if (s === undefined || st === undefined || h === undefined) return null;

  return (((((s * STRANDS.length + st) * HOLLAND_CODES.length + h) * 5 + (se - 1)) * 5 + (oe - 1)) * 5 + (b - 1));
}

function toBaseIndex(subject: (typeof SUBJECTS)[number], strand: (typeof STRANDS)[number], holland: string): number | null {
  const s = subjectIndex.get(subject);
  const st = strandIndex.get(strand);
  const h = hollandIndex.get(holland as (typeof HOLLAND_CODES)[number]);
  if (s === undefined || st === undefined || h === undefined) return null;
  return ((s * STRANDS.length + st) * HOLLAND_CODES.length + h);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function scoreFromCount(count: number): number {
  if (count <= 0) return 55;
  return Math.max(55, Math.min(99, Math.round((count / 125) * 100)));
}

export function predictFromDatasetMl(input: MlPredictInput): MlPrediction | null {
  const bestSubject = computeBestSubject(input.grades);
  const shsStrand = mapStrand(input.strand);
  const hc = hollandCode(input.riasecScores);
  const se = clampLikert(input.scctScores.self_efficacy ?? 3);
  const oe = clampLikert(input.scctScores.outcome_expectations ?? 3);
  const b = clampLikert(input.scctScores.perceived_barriers ?? 3);

  const idx = toIndex(bestSubject, shsStrand, hc, se, oe, b);
  if (idx === null || idx < 0 || idx >= classIds.length) return null;

  const labelId = classIds[idx];
  const label = LABELS[labelId];
  if (!label) return null;

  const baseIndex = toBaseIndex(bestSubject, shsStrand, hc);
  if (baseIndex === null) return null;

  const rankedLabelIds: number[] = [labelId];
  const rankedCounts: number[] = [125];
  for (let i = 0; i < TOP_K; i++) {
    const slot = baseIndex * TOP_K + i;
    if (slot < 0 || slot >= baseTopLabelIds.length) continue;
    const nextId = baseTopLabelIds[slot];
    if (nextId === 65535) continue;
    rankedLabelIds.push(nextId);
    rankedCounts.push(baseTopCounts[slot] ?? 0);
  }

  const orderedIds = unique(rankedLabelIds);
  const ordered = orderedIds
    .map((id, i) => ({
      id,
      label: LABELS[id],
      count: rankedCounts[Math.min(i, rankedCounts.length - 1)] ?? 0
    }))
    .filter(row => !!row.label);

  const courses: { name: string; match: number; reason: string }[] = [];
  const careers: { name: string; match: number; note: string }[] = [];

  for (const row of ordered) {
    if (courses.length < 6 && !courses.some(c => c.name === row.label.course)) {
      const exact = row.id === labelId;
      courses.push({
        name: row.label.course,
        match: exact ? 100 : scoreFromCount(row.count),
        reason: exact
          ? `Exact dataset match using ${bestSubject}, ${shsStrand}, ${hc}, and SCCT ${se}/${oe}/${b}.`
          : `Frequent dataset outcome for ${bestSubject}, ${shsStrand}, and ${hc}.`
      });
    }
    if (careers.length < 6 && !careers.some(c => c.name === row.label.career)) {
      const exact = row.id === labelId;
      careers.push({
        name: row.label.career,
        match: exact ? 100 : scoreFromCount(row.count),
        note: exact
          ? 'Exact dataset match from your profile and assessment signals.'
          : 'Common dataset outcome for students with similar profile patterns.'
      });
    }
    if (courses.length >= 6 && careers.length >= 6) break;
  }

  return {
    bestCareer: label.career,
    bestCourse: label.course,
    bestSubject,
    hollandCode: hc,
    shsStrand,
    scct: { se, oe, b },
    courses,
    careers
  };
}
