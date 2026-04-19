import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav, { SaveStatus } from '../components/TopNav';
import { SCCT_ITEMS, SCCT_OPTIONS, CONSTRUCT_META, ScctConstruct } from '../data/scct';
import { api } from '../lib/api';

export default function ScctAssessment() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const total = SCCT_ITEMS.length;
  const item = SCCT_ITEMS[idx];

  useEffect(() => {
    api<{ answers: Record<number, number> }>('/assessment/scct').then(r => {
      if (r.answers) {
        setAnswers(r.answers);
        const firstUnanswered = SCCT_ITEMS.findIndex(q => !(q.id in r.answers));
        if (firstUnanswered >= 0) setIdx(firstUnanswered);
      }
    }).catch(() => {});
  }, []);

  const constructs: ScctConstruct[] = ['self_efficacy', 'outcome_expectations', 'perceived_barriers'];
  const meta = CONSTRUCT_META[item.construct];
  const constructIdx = constructs.indexOf(item.construct);

  function select(v: number) {
    const updated = { ...answers, [item.id]: v };
    setAnswers(updated);
    api('/assessment/scct', { method: 'PUT', body: JSON.stringify({ id: item.id, value: v }) }).catch(() => {});
  }

  async function next() {
    if (idx < total - 1) {
      setIdx(idx + 1);
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      await api('/assessment/scct/submit', { method: 'POST' });
      nav('/portal/student/dashboard');
    } catch (e: any) {
      setErr(e?.message || 'Could not generate your results. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const answered = Object.keys(answers).length;
  const pct = Math.round((answered / total) * 100);
  const selected = answers[item.id];

  return (
    <div className="min-h-screen">
      <TopNav sticky right={<div className="flex items-center gap-4 sm:gap-6"><SaveStatus /><a href="#" onClick={e => { e.preventDefault(); nav('/'); }} className="text-sm text-ink-500 hover:text-ink-900">Save & exit</a></div>} />

      <div className="bg-cream-50 border-b border-cream-300 px-4 sm:px-8 py-5">
        <div className="max-w-[1200px] mx-auto flex flex-wrap items-center gap-4 sm:gap-8">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-xs text-ink-300 tracking-[0.1em]">SCCT REFLECTION</span>
            <span className="font-display text-lg font-medium">{answered}</span>
            <span className="font-mono text-ink-500 text-[15px]">/ {total}</span>
          </div>
          <div className="flex-1 min-w-[160px] h-1 bg-cream-200 rounded overflow-hidden">
            <div className="h-full bg-forest-700 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-sm text-forest-700 font-medium">{pct}%</span>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-16 grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <span className="inline-flex items-center gap-2.5 px-4 py-2 bg-terracotta-100 border border-terracotta-400 rounded-full text-[13px] text-terracotta-800 mb-8">
            <span className="w-2 h-2 bg-terracotta-600 rounded-full" />
            Construct {constructIdx + 1} of 3
          </span>
          <h1 className="text-4xl sm:text-5xl leading-[1.05] mb-6">
            {meta.title}<br />
            <span className="italic-serif">{meta.italicTail}</span>
          </h1>
          <p className="text-ink-500 text-[16px] leading-relaxed mb-10">{meta.description}</p>

          <div className="space-y-1">
            {constructs.map((c, i) => {
              const status: 'done' | 'active' | 'pending' = c === item.construct ? 'active' : i < constructIdx ? 'done' : 'pending';
              const m = CONSTRUCT_META[c];
              return (
                <div
                  key={c}
                  className={`py-3 border-l-2 pl-4 transition ${status === 'active' ? 'border-forest-700' : status === 'done' ? 'border-forest-400' : 'border-cream-300'}`}
                >
                  <div className={`text-[15px] font-medium ${status === 'pending' ? 'text-ink-300' : 'text-ink-900'}`}>
                    {m.title} {m.italicTail.replace('.', '')}
                  </div>
                  <div className="font-mono text-[11px] tracking-[0.12em] text-ink-300 mt-1">
                    4 ITEMS · {status === 'done' ? 'DONE' : status === 'active' ? 'IN PROGRESS' : 'NEXT'}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="bg-white border border-cream-300 rounded-lg p-6 sm:p-10 shadow-sm">
          <div className="flex justify-between items-baseline mb-6">
            <span className="font-mono text-xs tracking-[0.12em] uppercase text-ink-300">QUESTION {String(idx + 1).padStart(2, '0')} OF {total}</span>
            <span className="font-mono text-xs tracking-[0.12em] uppercase text-terracotta-600">{meta.title.toUpperCase()} {meta.italicTail.replace('.', '').toUpperCase()}</span>
          </div>

          <blockquote className="font-display text-[22px] sm:text-2xl leading-snug mb-6 border-l-4 border-terracotta-600 pl-6 italic">
            "{item.prompt}"
          </blockquote>

          <p className="text-ink-500 text-[15px] leading-relaxed mb-8">
            <strong className="text-ink-900 font-medium">Be honest with yourself.</strong> There are no right or wrong answers — your beliefs about the future are part of who you are right now, and they shape the recommendations we give you.
          </p>

          <div className="space-y-2.5">
            {SCCT_OPTIONS.map(opt => {
              const sel = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => select(opt.value)}
                  className={`w-full flex items-center gap-4 px-5 py-4 border rounded-lg text-left transition ${sel ? 'bg-forest-50 border-forest-700 border-2 py-[calc(1rem-1px)] px-[calc(1.25rem-1px)]' : 'bg-cream-100 border-cream-300 hover:border-ink-300 hover:bg-cream-50 hover:translate-x-0.5'}`}
                >
                  <span
                    className={`w-10 h-10 rounded-full border flex items-center justify-center font-display font-medium ${sel ? 'bg-forest-700 border-forest-700 text-cream-50' : 'bg-white border-cream-300 text-ink-500'}`}
                  >
                    {opt.value}
                  </span>
                  <span className="flex-1">
                    <span className={`block text-[15px] ${sel ? 'font-medium' : ''}`}>{opt.label}</span>
                    <span className="block text-[13px] text-ink-500 mt-0.5">{opt.nuance}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {err && (
            <div className="mt-6 text-sm text-terracotta-800 bg-terracotta-100 border border-terracotta-400 rounded px-3 py-2">
              {err}
            </div>
          )}

          <div className="flex flex-wrap justify-between items-center gap-4 mt-8 pt-7 border-t border-cream-300">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => setIdx(idx - 1)}
              className="bg-white border border-cream-300 text-ink-900 py-3 px-5 font-medium text-sm rounded-lg inline-flex items-center gap-2 transition hover:border-ink-300 hover:bg-cream-50 disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11 7H3m0 0l4 4m-4-4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Previous
            </button>
            <button
              type="button"
              onClick={next}
              disabled={selected === undefined || submitting}
              className="bg-forest-700 hover:bg-forest-600 text-cream-50 py-3 px-5 font-medium text-sm rounded-lg inline-flex items-center gap-2 transition disabled:opacity-40"
            >
              {idx === total - 1 ? (submitting ? 'Finishing…' : 'See my results') : 'Next reflection'}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8m0 0L7 3m4 4L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
