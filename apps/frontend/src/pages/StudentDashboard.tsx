import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PortalLayout from '../components/PortalLayout';
import { studentNavItems } from '../lib/portalNav';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../lib/auth';

type ProfileResponse = {
  strand?: string | null;
  school?: string | null;
  gradeLevel?: string | null;
  basicsCompleted?: boolean;
  grades?: Record<string, Record<string, number | string>> | null;
};

type ResultSummary = {
  hollandCode: string;
  courses: { name: string; match: number; reason?: string }[];
  careers: { name: string; match: number; note?: string }[];
};

type ExplainResponse = {
  reply: string;
  source: 'rule_based' | 'external_ai';
  externalAi: { consented: boolean; configured: boolean; used: boolean };
};

const REQUIRED_RIASEC = 48;
const REQUIRED_SCCT = 12;

function pct(v: number, max: number) {
  return Math.min(100, Math.round((v / max) * 100));
}

function bestSubjectFromGrades(grades: ProfileResponse['grades']): { subject: string; average: number } | null {
  if (!grades) return null;
  let best: { subject: string; average: number } | null = null;
  for (const [subject, row] of Object.entries(grades)) {
    if (!row || typeof row !== 'object') continue;
    const nums = Object.values(row)
      .map(v => (typeof v === 'number' ? v : Number.parseFloat(String(v))))
      .filter(n => Number.isFinite(n)) as number[];
    if (nums.length === 0) continue;
    const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
    if (!best || avg > best.average) best = { subject, average: avg };
  }
  return best;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [results, setResults] = useState<ResultSummary | null>(null);
  const [riasecAnswered, setRiasecAnswered] = useState(0);
  const [scctAnswered, setScctAnswered] = useState(0);

  const [messages, setMessages] = useState<{ role: 'student' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Hi! I can explain your Holland code, course fit, or next academic steps. Ask away.' }
  ]);
  const [draft, setDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [profileRes, riasecRes, scctRes, resultsRes] = await Promise.all([
          api<ProfileResponse>('/profile').catch(() => null),
          api<{ answers: Record<string, number> }>('/assessment/riasec').catch(() => ({ answers: {} })),
          api<{ answers: Record<string, number> }>('/assessment/scct').catch(() => ({ answers: {} })),
          api<ResultSummary>('/results').catch((err: unknown) => {
            if (err instanceof ApiError && err.status === 400) return null;
            return null;
          })
        ]);
        setProfile(profileRes);
        setRiasecAnswered(Object.keys(riasecRes.answers || {}).length);
        setScctAnswered(Object.keys(scctRes.answers || {}).length);
        setResults(resultsRes);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const bestSubject = useMemo(() => bestSubjectFromGrades(profile?.grades), [profile]);
  const profileCompletion = useMemo(() => {
    const checks = [
      !!profile?.school,
      !!profile?.gradeLevel,
      !!profile?.strand,
      !!profile?.basicsCompleted,
      !!bestSubject
    ];
    const done = checks.filter(Boolean).length;
    return pct(done, checks.length);
  }, [profile, bestSubject]);

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
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: err?.message || 'I could not answer that right now. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <PortalLayout
      title="Dashboard"
      subtitle={`Welcome, ${user?.name || 'Student'}`}
      navItems={studentNavItems}
    >
      {loading ? (
        <div className="text-ink-500">Loading your student summary…</div>
      ) : (
        <div className="grid xl:grid-cols-[1.4fr_1fr] gap-6">
          <div className="space-y-6">
            <section className="bg-white border border-cream-300 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl">Student summary</h2>
                <Link to="/portal/student/result" className="btn btn-primary btn-sm">
                  View assessment result
                </Link>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div className="border border-cream-300 rounded p-3">
                  <div className="text-ink-500">School</div>
                  <div className="font-medium mt-1">{profile?.school || 'Not set'}</div>
                </div>
                <div className="border border-cream-300 rounded p-3">
                  <div className="text-ink-500">Grade level</div>
                  <div className="font-medium mt-1">{profile?.gradeLevel ? `Grade ${profile.gradeLevel}` : 'Not set'}</div>
                </div>
                <div className="border border-cream-300 rounded p-3">
                  <div className="text-ink-500">SHS strand</div>
                  <div className="font-medium mt-1">{profile?.strand || 'Not set'}</div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Profile completion</span>
                    <span className="font-mono text-forest-700">
                      {profileCompletion}%
                      {bestSubject && (
                        <span className="ml-3 text-ink-500">
                          Best subject: <span className="text-forest-700">{bestSubject.subject} ({bestSubject.average.toFixed(2)})</span>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-cream-200 rounded overflow-hidden">
                    <div className="h-full bg-forest-700" style={{ width: `${profileCompletion}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>RIASEC completion</span>
                    <span className="font-mono text-forest-700">
                      {riasecAnswered}/{REQUIRED_RIASEC}
                      {results?.hollandCode && (
                        <span className="ml-3 text-ink-500">
                          Holland code: <span className="text-forest-700">{results.hollandCode}</span>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-cream-200 rounded overflow-hidden">
                    <div className="h-full bg-forest-700" style={{ width: `${pct(riasecAnswered, REQUIRED_RIASEC)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>SCCT completion</span>
                    <span className="font-mono text-forest-700">{scctAnswered}/{REQUIRED_SCCT}</span>
                  </div>
                  <div className="h-1.5 bg-cream-200 rounded overflow-hidden">
                    <div className="h-full bg-forest-700" style={{ width: `${pct(scctAnswered, REQUIRED_SCCT)}%` }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-cream-300 rounded-lg p-6">
                <h2 className="text-xl mb-3">Career recommendation preview</h2>
                {!results ? (
                  <p className="text-sm text-ink-500">Finish both assessments to view your top career matches.</p>
                ) : (
                  <div className="space-y-2">
                    {results.careers.slice(0, 3).map(c => (
                      <div key={c.name} className="border border-cream-300 rounded p-3 text-sm flex justify-between gap-3">
                        <span className="font-medium">{c.name}</span>
                        <span className="font-mono text-forest-700">{c.match}%</span>
                      </div>
                    ))}
                  </div>
                )}
                <Link to="/portal/student/result" className="btn btn-ghost mt-4 btn-sm">Open full results</Link>
              </div>

              <div className="bg-white border border-cream-300 rounded-lg p-6">
                <h2 className="text-xl mb-3">Course recommendation preview</h2>
                {!results ? (
                  <p className="text-sm text-ink-500">Finish both assessments to view your top course matches.</p>
                ) : (
                  <div className="space-y-2">
                    {results.courses.slice(0, 3).map(c => (
                      <div key={c.name} className="border border-cream-300 rounded p-3 text-sm flex justify-between gap-3">
                        <span className="font-medium">{c.name}</span>
                        <span className="font-mono text-forest-700">{c.match}%</span>
                      </div>
                    ))}
                  </div>
                )}
                <Link to="/portal/student/result" className="btn btn-ghost mt-4 btn-sm">Open full results</Link>
              </div>
            </section>
          </div>

          <aside className="bg-white border border-cream-300 rounded-lg h-[620px] flex flex-col">
            <div className="p-4 border-b border-cream-300">
              <div className="font-medium">CareerLinkAI</div>
              <div className="text-sm text-ink-500">Ask about your results, strand, or next steps.</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'student' ? 'justify-end' : ''}`}>
                  <div className={`max-w-[90%] px-3 py-2 rounded text-sm ${m.role === 'student' ? 'bg-forest-700 text-cream-50' : 'bg-cream-100 text-ink-900'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && <div className="text-sm text-ink-500">Thinking…</div>}
            </div>
            <form onSubmit={send} className="p-3 border-t border-cream-300 flex gap-2">
              <input
                className="input flex-1"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Ask CareerLinkAI"
              />
              <button type="submit" className="btn btn-primary" disabled={chatLoading || !draft.trim()}>Send</button>
            </form>
          </aside>
        </div>
      )}
    </PortalLayout>
  );
}
