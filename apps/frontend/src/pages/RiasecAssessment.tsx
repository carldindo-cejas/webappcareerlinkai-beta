import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav, { SaveStatus } from '../components/TopNav';
import { RIASEC_ITEMS } from '../data/riasec';
import { api } from '../lib/api';

function shuffleItems<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function RiasecAssessment() {
  const [items] = useState(() => shuffleItems(RIASEC_ITEMS));
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();
  const total = items.length;
  const item = items[idx];

  useEffect(() => {
    api<{ answers: Record<number, number> }>('/assessment/riasec').then(r => {
      if (r.answers) {
        setAnswers(r.answers);
        const firstUnanswered = items.findIndex(q => !(q.id in r.answers));
        if (firstUnanswered >= 0) setIdx(firstUnanswered);
      }
    }).catch(() => {});
  }, [items]);

  const select = useCallback(
    (value: number) => {
      const updated = { ...answers, [item.id]: value };
      setAnswers(updated);
      api('/assessment/riasec', { method: 'PUT', body: JSON.stringify({ id: item.id, value }) }).catch(() => {});
      setTimeout(() => {
        if (idx < total - 1) setIdx(idx + 1);
      }, 220);
    },
    [answers, item, idx, total]
  );

  const go = (d: -1 | 1) => {
    const next = idx + d;
    if (next >= 0 && next < total) setIdx(next);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '1' && e.key <= '5') select(parseInt(e.key, 10));
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select, idx]);

  async function finish() {
    setSubmitting(true);
    try {
      await api('/assessment/riasec/submit', { method: 'POST' });
      nav('/assessment/scct');
    } finally {
      setSubmitting(false);
    }
  }

  const answered = Object.keys(answers).length;
  const pct = Math.round((answered / total) * 100);
  const selected = answers[item.id];

  const dotClass = (i: number) => {
    if (i === idx) return 'bg-terracotta-600 scale-[1.4] ring-4 ring-terracotta-600/15';
    if ((items[i].id in answers)) return 'bg-forest-700';
    return 'bg-cream-300';
  };

  return (
    <div className="min-h-screen">
      <TopNav sticky right={<div className="flex items-center gap-4 sm:gap-6"><SaveStatus /><a href="#" onClick={e => { e.preventDefault(); nav('/'); }} className="text-sm text-ink-500 hover:text-ink-900">Save & exit</a></div>} />

      <div className="bg-cream-50 border-b border-cream-300 px-4 sm:px-8 py-5">
        <div className="max-w-[1200px] mx-auto flex flex-wrap items-center gap-4 sm:gap-8">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-xs text-ink-300 tracking-[0.1em]">RIASEC ASSESSMENT</span>
            <span className="font-display text-lg font-medium">{answered}</span>
            <span className="font-mono text-ink-500 text-[15px]">/ {total}</span>
          </div>
          <div className="flex-1 min-w-[160px] h-1 bg-cream-200 rounded overflow-hidden">
            <div className="h-full bg-forest-700 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-sm text-forest-700 font-medium">{pct}%</span>
        </div>
      </div>

      <main className="max-w-[760px] mx-auto px-4 sm:px-8 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-terracotta-100 border border-terracotta-400 rounded-full text-[13px] text-terracotta-800 mb-6">
          <span className="w-2 h-2 bg-terracotta-600 rounded-full" />
          {item.section}
        </div>

        <div className="font-mono text-xs tracking-[0.14em] uppercase text-terracotta-600 mb-8">
          Question {idx + 1} of {total}
        </div>

        <h1 className="font-display text-3xl sm:text-[2.875rem] leading-[1.2] font-normal tracking-tight text-ink-900 mb-4 max-w-[680px] mx-auto">
          "{item.prompt}"
        </h1>
        <p className="text-base text-ink-500 mb-16">How accurately does this describe you?</p>

        <div className="relative flex justify-between items-center gap-2 sm:gap-4 max-w-[600px] mx-auto mb-12">
          <div className="absolute top-1/2 left-[8%] right-[8%] h-px bg-cream-300 -z-0" />
          {[1, 2, 3, 4, 5].map((v, i) => {
            const sel = selected === v;
            const base = 'relative z-10 rounded-full flex items-center justify-center font-display font-medium transition-all duration-200 cursor-pointer';
            const size = i === 0 || i === 4 ? 'w-12 h-12 text-sm' : i === 1 || i === 3 ? 'w-14 h-14 text-base' : 'w-16 h-16 text-lg';
            const state = sel
              ? 'bg-forest-700 border-forest-700 text-cream-50 scale-110'
              : 'bg-white border border-cream-300 text-ink-500 hover:border-forest-700 hover:text-forest-700 hover:scale-105';
            return (
              <button key={v} onClick={() => select(v)} className={`${base} ${size} ${state}`}>
                {v}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between max-w-[600px] mx-auto mb-16 text-[13px] text-ink-500 font-mono tracking-wide">
          <span>STRONGLY DISAGREE</span>
          <span className="text-center flex-1 px-4 hidden sm:block">NEUTRAL</span>
          <span className="text-right">STRONGLY AGREE</span>
        </div>

        <div className="flex justify-between items-center max-w-[760px] mx-auto">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => go(-1)}
            className="bg-white border border-cream-300 text-ink-900 py-3.5 px-6 font-medium rounded-lg inline-flex items-center gap-2 transition hover:border-ink-300 hover:bg-cream-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 7H3m0 0l4 4m-4-4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Previous
          </button>
          {idx === total - 1 && answered === total ? (
            <button
              type="button"
              onClick={finish}
              disabled={submitting}
              className="bg-forest-700 hover:bg-forest-600 text-cream-50 py-3.5 px-6 font-medium rounded-lg inline-flex items-center gap-2 transition disabled:opacity-60"
            >
              {submitting ? 'Finishing…' : 'Continue to SCCT'}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8m0 0L7 3m4 4L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go(1)}
              disabled={idx === total - 1}
              className="bg-forest-700 hover:bg-forest-600 text-cream-50 py-3.5 px-6 font-medium rounded-lg inline-flex items-center gap-2 transition disabled:opacity-40"
            >
              Next question
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8m0 0L7 3m4 4L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        <p className="hidden md:block text-center mt-16 font-mono text-xs text-ink-300 tracking-wide">
          TIP — USE <kbd className="inline-block px-2 py-0.5 bg-cream-200 border border-cream-300 rounded text-[11px] text-ink-900 mx-0.5">1</kbd>
          <kbd className="inline-block px-2 py-0.5 bg-cream-200 border border-cream-300 rounded text-[11px] text-ink-900 mx-0.5">2</kbd>
          <kbd className="inline-block px-2 py-0.5 bg-cream-200 border border-cream-300 rounded text-[11px] text-ink-900 mx-0.5">3</kbd>
          <kbd className="inline-block px-2 py-0.5 bg-cream-200 border border-cream-300 rounded text-[11px] text-ink-900 mx-0.5">4</kbd>
          <kbd className="inline-block px-2 py-0.5 bg-cream-200 border border-cream-300 rounded text-[11px] text-ink-900 mx-0.5">5</kbd> TO ANSWER ·
          <kbd className="inline-block px-2 py-0.5 bg-cream-200 border border-cream-300 rounded text-[11px] text-ink-900 mx-0.5 ml-2">←</kbd>
          <kbd className="inline-block px-2 py-0.5 bg-cream-200 border border-cream-300 rounded text-[11px] text-ink-900 mx-0.5">→</kbd> TO NAVIGATE
        </p>

        <div className="flex justify-center flex-wrap gap-1 max-w-[720px] mx-auto mt-12">
          {items.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`w-2.5 h-2.5 rounded-full transition ${dotClass(i)}`} aria-label={`Go to question ${i + 1}`} />
          ))}
        </div>
      </main>
    </div>
  );
}
