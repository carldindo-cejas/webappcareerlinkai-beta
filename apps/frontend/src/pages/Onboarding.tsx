import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav, { SaveStatus } from '../components/TopNav';
import Stepper from '../components/Stepper';
import { GRADE_LEVELS, STRANDS, SUBJECTS, Strand } from '../data/strands';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type SubjectCode = (typeof SUBJECTS)[number];
type GradeLevel = (typeof GRADE_LEVELS)[number];
type GradeMatrix = Record<SubjectCode, Record<GradeLevel, string>>;

const SUBJECT_ALIASES: Record<SubjectCode, string[]> = {
  Math: ['Math', 'math', 'Mathematics', 'mathematics'],
  English: ['English', 'english'],
  Science: ['Science', 'science']
};

function emptyMatrix(): GradeMatrix {
  return {
    Math: { 7: '', 8: '', 9: '', 10: '' },
    English: { 7: '', 8: '', 9: '', 10: '' },
    Science: { 7: '', 8: '', 9: '', 10: '' }
  };
}

function toStringOrBlank(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim() !== '') return value;
  return '';
}

function normalizeIncomingGrades(input: unknown): GradeMatrix {
  const matrix = emptyMatrix();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return matrix;
  const source = input as Record<string, any>;

  for (const subject of SUBJECTS) {
    const aliasValue = SUBJECT_ALIASES[subject]
      .map(alias => source[alias])
      .find(value => value !== undefined);

    if (typeof aliasValue === 'number' && Number.isFinite(aliasValue)) {
      for (const level of GRADE_LEVELS) matrix[subject][level] = String(aliasValue);
      continue;
    }

    const nested = aliasValue && typeof aliasValue === 'object' && !Array.isArray(aliasValue)
      ? aliasValue as Record<string, any>
      : {};

    for (const level of GRADE_LEVELS) {
      const nestedCandidates = [
        nested[String(level)],
        nested[`grade${level}`],
        nested[`Grade${level}`],
        nested[`Grade ${level}`],
        nested[`g${level}`],
        nested[`G${level}`]
      ];

      const flatCandidates = SUBJECT_ALIASES[subject].flatMap(alias => [
        source[`${alias}_${level}`],
        source[`${alias}-${level}`],
        source[`${alias}${level}`],
        source[`${alias.toLowerCase()}_${level}`],
        source[`${alias.toLowerCase()}-${level}`],
        source[`${alias.toLowerCase()}${level}`]
      ]);

      const resolved = [...nestedCandidates, ...flatCandidates].find(v => v !== undefined);
      matrix[subject][level] = toStringOrBlank(resolved);
    }
  }

  return matrix;
}

function averageForSubject(row: Record<GradeLevel, string>): string {
  const nums = GRADE_LEVELS
    .map(level => Number.parseFloat(row[level]))
    .filter(value => Number.isFinite(value));
  if (nums.length !== GRADE_LEVELS.length) return '—';
  const avg = nums.reduce((sum, value) => sum + value, 0) / nums.length;
  return avg.toFixed(2);
}

export default function Onboarding() {
  const [strand, setStrand] = useState<Strand['code'] | null>(null);
  const [lockedStrand, setLockedStrand] = useState<Strand['code'] | null>(null);
  const [grades, setGrades] = useState<GradeMatrix>(emptyMatrix());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { refresh } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    api<{ strand?: string; grades?: unknown; basicsCompleted?: boolean }>('/profile').then(p => {
      if (!p.basicsCompleted) {
        nav('/profile/basics', { replace: true });
        return;
      }
      if (p.strand) {
        const invited = STRANDS.find(s => s.code === p.strand);
        if (invited) {
          setStrand(invited.code);
          setLockedStrand(invited.code);
        }
      }
      if (p.grades) setGrades(normalizeIncomingGrades(p.grades));
    }).catch(() => {});
  }, [nav]);

  function updateGrade(subject: SubjectCode, level: GradeLevel, value: string) {
    setGrades(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        [level]: value
      }
    }));
  }

  async function onContinue() {
    setErr(null);
    if (!strand) { setErr('Please pick a strand.'); return; }

    const gradesNum: Record<SubjectCode, Record<GradeLevel, number>> = {
      Math: { 7: 0, 8: 0, 9: 0, 10: 0 },
      English: { 7: 0, 8: 0, 9: 0, 10: 0 },
      Science: { 7: 0, 8: 0, 9: 0, 10: 0 }
    };

    for (const subject of SUBJECTS) {
      for (const level of GRADE_LEVELS) {
        const value = Number.parseFloat(grades[subject][level]);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          setErr(`Enter a valid ${subject} Grade ${level} score from 0 to 100.`);
          return;
        }
        gradesNum[subject][level] = Number(value.toFixed(2));
      }
    }

    setSaving(true);
    try {
      await api('/profile', {
        method: 'PUT',
        body: JSON.stringify({ strand, grades: gradesNum })
      });
      setSaved(true);
      await refresh();
      nav('/assessment/riasec');
    } catch (e: any) {
      setErr(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <TopNav right={<SaveStatus label={saved ? 'SAVED · JUST NOW' : 'UNSAVED CHANGES'} />} />
      <Stepper
        steps={[
          { name: 'Profile', status: 'done' },
          { name: 'Academic background', status: 'active' },
          { name: 'RIASEC assessment', status: 'pending' },
          { name: 'SCCT reflection', status: 'pending' },
          { name: 'Your results', status: 'pending' }
        ]}
      />

      <main className="max-w-[760px] mx-auto px-4 sm:px-8 py-16 pb-24">
        <span className="eyebrow block mb-5">Step two of five · Academic background</span>
        <h1 className="text-4xl sm:text-[2.75rem] leading-[1.1] mb-4">
          Tell us about your <span className="italic-serif">studies.</span>
        </h1>
        <p className="text-[18px] text-ink-500 leading-relaxed mb-12 max-w-[580px]">
          Your senior high strand and your Grade 7 to 10 academic record help us understand which courses are a natural extension of what you already enjoy and excel at.
        </p>

        <h3 className="text-[17px] font-medium mb-4">Which strand are you in?</h3>
        {lockedStrand && (
          <p className="text-[13px] text-ink-500 mb-4">
            Your strand is locked to the invitation code assigned by your counselor.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {STRANDS.map(s => {
            const sel = strand === s.code;
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  if (!lockedStrand) setStrand(s.code);
                }}
                className={`relative text-left bg-white border rounded-lg p-6 transition ${lockedStrand ? 'cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow'} ${sel ? 'border-forest-700 border-2 bg-forest-50 p-[calc(1.5rem-1px)]' : 'border-cream-300 hover:border-ink-300'}`}
              >
                {sel && (
                  <span className="absolute top-5 right-5 w-[22px] h-[22px] bg-forest-700 rounded-full flex items-center justify-center text-cream-50">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 6L5 8L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                <div className={`font-mono text-[11px] tracking-[0.1em] font-medium mb-2 ${sel ? 'text-forest-700' : 'text-terracotta-600'}`}>{s.code}</div>
                <div className="font-display text-xl font-medium mb-1.5 leading-tight">{s.name}</div>
                <div className="text-sm text-ink-500 leading-snug">{s.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="bg-cream-50 border border-cream-300 rounded-lg p-6 sm:p-8 mb-6">
          <div className="flex flex-wrap justify-between items-baseline gap-2 mb-6 pb-5 border-b border-cream-300">
            <h3 className="text-xl font-medium">Your academic record</h3>
            <span className="text-[13px] text-ink-500">All on a 100-point scale</span>
          </div>

          <div className="pt-6 border-t border-cream-300">
            <div className="grid grid-cols-[140px_repeat(4,minmax(0,1fr))_90px] gap-2 text-[12px] font-mono tracking-[0.08em] text-ink-400 uppercase mb-2">
              <span>Subject</span>
              {GRADE_LEVELS.map(level => (
                <span key={level} className="text-center">G{level}</span>
              ))}
              <span className="text-center">Avg</span>
            </div>

            <div className="space-y-2">
              {SUBJECTS.map(subject => (
                <div key={subject} className="grid grid-cols-[140px_repeat(4,minmax(0,1fr))_90px] gap-2 items-center py-2 border-b border-dashed border-cream-300 last:border-0">
                  <span className="text-[15px] font-medium">{subject}</span>
                  {GRADE_LEVELS.map(level => (
                    <input
                      key={`${subject}-${level}`}
                      className="w-full text-center py-2 bg-white border border-cream-300 rounded-sm font-mono text-[15px] focus:outline-none focus:border-forest-700"
                      value={grades[subject][level]}
                      onChange={e => updateGrade(subject, level, e.target.value)}
                      placeholder="0"
                    />
                  ))}
                  <div className="text-center font-mono text-[13px] text-forest-700">
                    {averageForSubject(grades[subject])}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-ink-500 mt-4">
              Enter your Grade 7, 8, 9, and 10 final grades for Math, English, and Science. We compute each subject average automatically for prediction.
            </p>
          </div>
        </div>

        {err && (
          <div className="text-sm text-terracotta-800 bg-terracotta-100 border border-terracotta-400 rounded px-3 py-2 mb-6">
            {err}
          </div>
        )}

        <div className="flex flex-wrap justify-between items-center gap-4 mt-16 pt-8 border-t border-cream-300">
          <button
            type="button"
            onClick={() => nav('/')}
            className="inline-flex items-center gap-2 text-ink-500 hover:text-ink-900 text-[15px]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 7H3m0 0l4 4m-4-4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to home
          </button>
          <span className="font-mono text-xs text-ink-300 tracking-[0.1em]">2 / 5 STEPS</span>
          <button
            type="button"
            onClick={onContinue}
            disabled={saving}
            className="bg-forest-700 hover:bg-forest-600 text-cream-50 py-3.5 px-8 rounded-lg font-medium inline-flex items-center gap-2.5 transition hover:-translate-y-0.5 hover:shadow disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Continue to RIASEC'}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8m0 0L7 3m4 4L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}
