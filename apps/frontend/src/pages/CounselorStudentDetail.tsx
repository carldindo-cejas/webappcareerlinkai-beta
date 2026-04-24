import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Logo from '../components/Logo';
import RadarChart from '../components/RadarChart';
import { api } from '../lib/api';
import { RIASEC_LABELS, RiasecDim } from '../data/riasec';

type StudentResultsPayload = {
  student: { id: number; name: string; email: string };
  profile: {
    strand: string | null;
    gwa: number | null;
    grades: Record<string, any> | null;
  } | null;
  results: {
    generatedAt: number;
    hollandCode: string;
    riasec: Record<RiasecDim, number>;
    scct: Record<string, number>;
    courses: { name: string; match: number; reason: string }[];
    careers: { name: string; match: number; note: string }[];
  } | null;
};

export default function CounselorStudentDetail() {
  const { id } = useParams();
  const [data, setData] = useState<StudentResultsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api<StudentResultsPayload>(`/counselor/students/${id}/results`)
      .then(setData)
      .catch(e => setError(e.message || 'Failed to load student results.'));
  }, [id]);

  if (error) return <div className="min-h-screen flex items-center justify-center text-terracotta-800">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-ink-500">Loading…</div>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-cream-300 bg-cream-100">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center px-4 sm:px-8 py-5">
          <Logo />
          <Link to="/portal/counselor" className="text-sm text-ink-500 hover:text-ink-900">← Back to dashboard</Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-8">
        <section className="bg-white border border-cream-300 rounded-lg p-6 sm:p-8">
          <span className="eyebrow block mb-2">Student profile</span>
          <h1 className="text-4xl sm:text-5xl mb-3">{data.student.name}</h1>
          <p className="text-ink-500">{data.student.email}</p>
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-cream-50 border border-cream-300 rounded-lg p-4">
              <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-1">Strand</div>
              <div className="font-medium text-forest-700">{data.profile?.strand ?? '—'}</div>
            </div>
            <div className="bg-cream-50 border border-cream-300 rounded-lg p-4">
              <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-1">GWA</div>
              <div className="font-medium text-forest-700">{data.profile?.gwa?.toFixed(2) ?? '—'}</div>
            </div>
            <div className="bg-cream-50 border border-cream-300 rounded-lg p-4">
              <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-1">Result status</div>
              <div className="font-medium text-forest-700">{data.results ? 'Complete' : 'Pending'}</div>
            </div>
          </div>
        </section>

        {!data.results ? (
          <section className="bg-white border border-cream-300 rounded-lg p-8 text-center text-ink-500">
            This student has not generated assessment results yet.
          </section>
        ) : (
          <>
            <section className="bg-forest-700 text-cream-50 rounded-lg p-8 sm:p-10">
              <span className="eyebrow !text-terracotta-400 block mb-4">Holland summary</span>
              <div className="font-display text-7xl leading-none mb-3">{data.results.hollandCode}</div>
              <div className="flex flex-wrap gap-2">
                {data.results.hollandCode.split('').map(code => (
                  <span key={code} className="px-3 py-1.5 rounded-full bg-terracotta-400 text-ink-900 text-sm font-medium">
                    {code} — {RIASEC_LABELS[code as RiasecDim]}
                  </span>
                ))}
              </div>
            </section>

            <section className="bg-white border border-cream-300 rounded-lg p-6 sm:p-8 grid sm:grid-cols-[300px_1fr] gap-8 items-center">
              <div className="flex justify-center">
                <RadarChart values={data.results.riasec} max={5} size={280} />
              </div>
              <div className="space-y-3">
                {(Object.keys(RIASEC_LABELS) as RiasecDim[]).map(d => {
                  const v = data.results!.riasec[d] ?? 0;
                  return (
                    <div key={d}>
                      <div className="flex justify-between mb-1 text-sm">
                        <span>{d} — {RIASEC_LABELS[d]}</span>
                        <span className="font-mono text-forest-700">{v.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 bg-cream-200 rounded overflow-hidden">
                        <div className="h-full bg-forest-700" style={{ width: `${Math.round((v / 5) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border border-cream-300 rounded-lg p-6">
                <h2 className="text-xl mb-4">Recommended courses</h2>
                <div className="space-y-3">
                  {data.results.courses.map(c => (
                    <div key={c.name} className="border border-cream-300 rounded-lg p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="font-mono text-forest-700">{c.match}%</div>
                      </div>
                      <div className="text-sm text-ink-500 mt-1">{c.reason}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-cream-300 rounded-lg p-6">
                <h2 className="text-xl mb-4">Recommended careers</h2>
                <div className="space-y-3">
                  {data.results.careers.map(c => (
                    <div key={c.name} className="border border-cream-300 rounded-lg p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="font-mono text-forest-700">{c.match}%</div>
                      </div>
                      <div className="text-sm text-ink-500 mt-1">{c.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-4">SCCT scores</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {Object.entries(data.results.scct).map(([key, value]) => (
                  <div key={key} className="bg-cream-50 border border-cream-300 rounded-lg p-4">
                    <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-2">{key.replace(/_/g, ' ')}</div>
                    <div className="font-display text-4xl text-forest-700 leading-none">
                      {value.toFixed(1)} <span className="text-lg text-ink-300">/ 5</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
