import { FormEvent, useEffect, useMemo, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { studentNavItems } from '../lib/portalNav';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import RadarChart from '../components/RadarChart';
import { RIASEC_LABELS, RiasecDim } from '../data/riasec';

type Results = {
  riasec: Record<RiasecDim, number>;
  hollandCode: string;
  courses: { name: string; match: number; reason: string }[];
  careers: { name: string; match: number; note: string }[];
  scct: Record<string, number>;
};

type ProfileForResults = {
  grades?: Record<string, Record<string, number | string>> | null;
};

const SCCT_META: Record<string, { label: string; description: string }> = {
  self_efficacy: {
    label: 'Self-efficacy',
    description: 'How strongly you believe you can succeed in your chosen career path.'
  },
  outcome_expectations: {
    label: 'Outcome expectations',
    description: 'How positive you are about the rewards a good-fit career will bring.'
  },
  perceived_barriers: {
    label: 'Perceived barriers',
    description: 'How significant you view the obstacles on your career path.'
  }
};

function computeSubjectAverages(grades: ProfileForResults['grades']) {
  if (!grades) return [] as { subject: string; average: number }[];
  const rows: { subject: string; average: number }[] = [];
  for (const [subject, row] of Object.entries(grades)) {
    if (!row || typeof row !== 'object') continue;
    const nums = Object.values(row)
      .map(v => (typeof v === 'number' ? v : Number.parseFloat(String(v))))
      .filter(n => Number.isFinite(n)) as number[];
    if (nums.length === 0) continue;
    rows.push({ subject, average: nums.reduce((s, n) => s + n, 0) / nums.length });
  }
  return rows;
}

type ExplainResponse = {
  reply: string;
  source: 'rule_based' | 'ai';
};

export default function StudentResults() {
  const { user } = useAuth();
  const [results, setResults] = useState<Results | null>(null);
  const [profile, setProfile] = useState<ProfileForResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSource, setLastSource] = useState<'rule_based' | 'ai' | null>(null);
  const [messages, setMessages] = useState<{ role: 'student' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Hi! Ask me why a course matched your profile or how to prepare for your top careers.' }
  ]);
  const [draft, setDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api<Results>('/results').catch(() => null),
      api<ProfileForResults>('/profile').catch(() => null)
    ]).then(([res, prof]) => {
      setResults(res);
      setProfile(prof);
    }).finally(() => setLoading(false));
  }, []);

  const subjectAverages = useMemo(() => computeSubjectAverages(profile?.grades), [profile]);
  const bestSubject = useMemo(() => {
    if (subjectAverages.length === 0) return null;
    return subjectAverages.reduce((best, cur) => (cur.average > best.average ? cur : best));
  }, [subjectAverages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const q = draft.trim();
    if (!q) return;
    setDraft('');
    setMessages(prev => [...prev, { role: 'student', text: q }]);
    setChatLoading(true);
    try {
      const reply = await api<ExplainResponse>('/ai/explain', {
        method: 'POST',
        body: JSON.stringify({ question: q })
      });
      setMessages(prev => [...prev, { role: 'ai', text: reply.reply }]);
      setLastSource(reply.source);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: err.message || 'I could not answer that right now. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <PortalLayout
      title="Result"
      subtitle={`Welcome, ${user?.name || 'Student'}`}
      navItems={studentNavItems}
    >
      {loading ? (
        <div className="text-ink-500">Loading your results…</div>
      ) : !results ? (
        <div className="bg-white border border-cream-300 rounded-lg p-6 text-ink-500">
          Complete your assessments to view your recommendations.
        </div>
      ) : (
        <div className="grid xl:grid-cols-[1.4fr_1fr] gap-6">
          <div className="space-y-6">
            <section className="bg-forest-700 text-cream-50 rounded-lg p-6">
              <div className="eyebrow !text-terracotta-400 mb-2">Holland Code</div>
              <div className="font-display text-5xl leading-none mb-3">{results.hollandCode}</div>
              <div className="flex flex-wrap gap-2">
                {results.hollandCode.split('').map(c => (
                  <span key={c} className="px-3 py-1.5 bg-terracotta-400 text-ink-900 rounded-full text-sm">
                    {c} - {RIASEC_LABELS[c as RiasecDim]}
                  </span>
                ))}
              </div>
            </section>

            {subjectAverages.length > 0 && (
              <section className="bg-white border border-cream-300 rounded-lg p-6">
                <h2 className="text-xl mb-4">Grade Averages</h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  {subjectAverages.map(row => {
                    const isBest = bestSubject?.subject === row.subject;
                    return (
                      <div
                        key={row.subject}
                        className={`rounded-lg p-4 border ${isBest ? 'bg-terracotta-100 border-terracotta-400' : 'border-cream-300 bg-white'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-500">{row.subject}</div>
                          {isBest && (
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta-800">Best</span>
                          )}
                        </div>
                        <div className={`font-display text-3xl mt-2 leading-none ${isBest ? 'text-terracotta-800' : 'text-forest-700'}`}>
                          {row.average.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {bestSubject && (
                  <div className="mt-4 text-sm text-ink-500">
                    Best grade: <span className="text-forest-700 font-medium">{bestSubject.subject}</span>
                    <span className="ml-1">({bestSubject.average.toFixed(2)})</span>
                  </div>
                )}
              </section>
            )}

            <section className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-4">RIASEC Breakdown</h2>
              <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-center">
                <div className="flex justify-center">
                  <RadarChart values={results.riasec} max={5} size={250} />
                </div>
                <div className="space-y-3">
                  {(Object.keys(RIASEC_LABELS) as RiasecDim[]).map(d => {
                    const v = results.riasec[d] || 0;
                    const pct = Math.round((v / 5) * 100);
                    return (
                      <div key={d}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{d} - {RIASEC_LABELS[d]}</span>
                          <span className="font-mono text-forest-700">{v.toFixed(1)}</span>
                        </div>
                        <div className="h-1.5 bg-cream-200 rounded overflow-hidden">
                          <div className="h-full bg-forest-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-4">SCCT Breakdown</h2>
              <div className="space-y-3">
                {(['self_efficacy', 'outcome_expectations', 'perceived_barriers'] as const).map(key => {
                  const v = results.scct?.[key] ?? 0;
                  const pct = Math.round((v / 5) * 100);
                  const meta = SCCT_META[key];
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{meta.label}</span>
                        <span className="font-mono text-forest-700">{v.toFixed(1)}</span>
                      </div>
                      <div className="text-xs text-ink-500 mb-1">{meta.description}</div>
                      <div className="h-1.5 bg-cream-200 rounded overflow-hidden">
                        <div className="h-full bg-forest-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-4">Course Recommendations</h2>
              <div className="space-y-2">
                {results.courses.map(c => (
                  <div key={c.name} className="border border-cream-300 rounded p-3">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-forest-700">{c.match}%</span>
                    </div>
                    <div className="text-sm text-ink-500 mt-1">{c.reason}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-4">Career Directions</h2>
              <div className="space-y-2">
                {results.careers.map(c => (
                  <div key={c.name} className="border border-cream-300 rounded p-3">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-forest-700">{c.match}%</span>
                    </div>
                    <div className="text-sm text-ink-500 mt-1">{c.note}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="bg-white border border-cream-300 rounded-lg h-[620px] flex flex-col">
            <div className="p-4 border-b border-cream-300">
              <div className="font-medium">Ask CareerLinkAI</div>
              <div className="text-sm text-ink-500">Result-aware explanations, powered by Cloudflare Workers AI</div>
              {lastSource && (
                <div className="mt-1 text-xs text-ink-500">
                  Last reply source: {lastSource === 'ai' ? 'Workers AI (Llama 3)' : 'Built-in local guidance'}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'student' ? 'justify-end' : ''}`}>
                  <div className={`max-w-[90%] px-3 py-2 rounded text-sm ${m.role === 'student' ? 'bg-forest-700 text-cream-50' : 'bg-cream-100 text-ink-900'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="text-sm text-ink-500">Thinking…</div>
              )}
            </div>
            <form onSubmit={send} className="p-3 border-t border-cream-300 flex gap-2">
              <input
                className="input flex-1"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Ask about your recommendations"
              />
              <button type="submit" className="btn btn-primary" disabled={chatLoading}>Send</button>
            </form>
          </aside>
        </div>
      )}
    </PortalLayout>
  );
}
