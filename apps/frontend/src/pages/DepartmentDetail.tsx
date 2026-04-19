import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Logo from '../components/Logo';
import { api } from '../lib/api';

type Student = {
  id: number;
  name: string;
  email: string;
  status: 'pending' | 'in_progress' | 'complete';
  hollandCode?: string;
};

type Seminar = {
  id: number;
  title: string;
  description?: string;
  scheduledAt: number;
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
};

type DepartmentDetail = {
  id: number;
  name: string;
  strand: string;
  joinCode: string;
  joinUrl: string;
  students: Student[];
  seminars: Seminar[];
};

export default function DepartmentDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<DepartmentDetail | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'status'>('status');
  const [copied, setCopied] = useState(false);
  const [showSeminarForm, setShowSeminarForm] = useState(false);
  const [seminarTitle, setSeminarTitle] = useState('');
  const [seminarDescription, setSeminarDescription] = useState('');
  const [seminarWhen, setSeminarWhen] = useState('');
  const [savingSeminar, setSavingSeminar] = useState(false);
  const [seminarError, setSeminarError] = useState<string | null>(null);

  useEffect(() => {
    api<DepartmentDetail>(`/counselor/departments/${id}`).then(setData).catch(() => {});
  }, [id]);

  if (!data) return <div className="min-h-screen flex items-center justify-center text-ink-500">Loading…</div>;

  const counts = {
    pending: data.students.filter(s => s.status === 'pending').length,
    in_progress: data.students.filter(s => s.status === 'in_progress').length,
    complete: data.students.filter(s => s.status === 'complete').length
  };
  const pct = data.students.length
    ? Math.round((counts.complete / data.students.length) * 100)
    : 0;

  const sorted = [...data.students].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    const order = { complete: 0, in_progress: 1, pending: 2 } as const;
    return order[a.status] - order[b.status];
  });
  const seminars = data.seminars ?? [];

  function copyJoin() {
    navigator.clipboard.writeText(data!.joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  async function createSeminar() {
    if (!id || !seminarTitle.trim() || !seminarWhen) return;
    setSeminarError(null);
    setSavingSeminar(true);
    try {
      const created = await api<Seminar>(`/counselor/departments/${id}/seminars`, {
        method: 'POST',
        body: JSON.stringify({
          title: seminarTitle.trim(),
          description: seminarDescription.trim(),
          scheduledAt: new Date(seminarWhen).toISOString()
        })
      });

      setData(prev => prev ? { ...prev, seminars: [created, ...prev.seminars] } : prev);
      setSeminarTitle('');
      setSeminarDescription('');
      setSeminarWhen('');
      setShowSeminarForm(false);
    } catch (e: any) {
      setSeminarError(e.message || 'Could not create seminar.');
    } finally {
      setSavingSeminar(false);
    }
  }

  function formatWhen(unixSeconds: number) {
    return new Date(unixSeconds * 1000).toLocaleString();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-cream-300 bg-cream-100">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center px-4 sm:px-8 py-5">
          <Logo />
          <Link to="/portal/counselor" className="text-sm text-ink-500 hover:text-ink-900">← Back to dashboard</Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="mb-8">
          <span className="eyebrow block mb-2">{data.strand} department</span>
          <h1 className="text-4xl sm:text-5xl mb-2">{data.name}</h1>
          <p className="text-ink-500">{data.students.length} students · {pct}% complete</p>
        </div>

        {/* Join link card */}
        <section className="bg-forest-700 text-cream-50 rounded-lg p-6 sm:p-8 mb-10 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 border border-cream-100/10 rounded-full pointer-events-none" />
          <span className="eyebrow !text-terracotta-400 block mb-3">Invite link</span>
          <h2 className="!text-cream-50 text-2xl mb-4">Share this with your section.</h2>
          <div className="flex flex-wrap gap-3 items-stretch">
            <input
              readOnly
              value={data.joinUrl}
              className="flex-1 min-w-[240px] bg-white/10 border border-white/20 text-cream-50 rounded-lg px-4 py-3 font-mono text-sm"
              onFocus={e => e.currentTarget.select()}
            />
            <button onClick={copyJoin} className="bg-terracotta-400 text-ink-900 font-medium px-5 rounded-lg hover:bg-terracotta-600 hover:text-cream-50 transition">
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <p className="text-cream-200 text-sm mt-4">
            Join code: <span className="font-mono font-medium text-cream-50">{data.joinCode}</span>
          </p>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            ['Total', data.students.length],
            ['Pending', counts.pending],
            ['In progress', counts.in_progress],
            ['Complete', counts.complete]
          ].map(([l, v]) => (
            <div key={l as string} className="bg-white border border-cream-300 rounded-lg p-5">
              <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-2">{l}</div>
              <div className="font-display text-3xl font-medium text-forest-700 leading-none">{v}</div>
            </div>
          ))}
        </section>

        <section className="bg-white border border-cream-300 rounded-lg p-6 sm:p-8 mb-10">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div>
              <h2 className="text-xl">Activities and seminars</h2>
              <p className="text-sm text-ink-500">Invite all students in this department with one action.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSeminarForm(v => !v)}
              className="btn btn-primary"
            >
              {showSeminarForm ? 'Close' : '+ New seminar'}
            </button>
          </div>

          {showSeminarForm && (
            <div className="bg-cream-50 border border-cream-300 rounded-lg p-4 mb-5 space-y-3">
              <input
                className="input"
                value={seminarTitle}
                onChange={e => setSeminarTitle(e.target.value)}
                placeholder="Seminar title"
              />
              <textarea
                className="input min-h-24"
                value={seminarDescription}
                onChange={e => setSeminarDescription(e.target.value)}
                placeholder="Short description (optional)"
              />
              <input
                className="input"
                type="datetime-local"
                value={seminarWhen}
                onChange={e => setSeminarWhen(e.target.value)}
              />
              {seminarError && <div className="text-sm text-terracotta-800">{seminarError}</div>}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={createSeminar}
                  disabled={savingSeminar || !seminarTitle.trim() || !seminarWhen}
                  className="btn btn-primary"
                >
                  {savingSeminar ? 'Saving…' : 'Create and invite'}
                </button>
              </div>
            </div>
          )}

          {seminars.length === 0 ? (
            <div className="text-sm text-ink-500">No seminars yet for this department.</div>
          ) : (
            <div className="space-y-3">
              {seminars.map(s => (
                <div key={s.id} className="border border-cream-300 rounded-lg p-4">
                  <div className="flex flex-wrap justify-between gap-3 mb-2">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-sm text-ink-500">{formatWhen(s.scheduledAt)}</div>
                  </div>
                  {s.description && <p className="text-sm text-ink-500 mb-3">{s.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs font-mono tracking-wide text-ink-500">
                    <span>INVITED {s.invited}</span>
                    <span>ACCEPTED {s.accepted}</span>
                    <span>PENDING {s.pending}</span>
                    <span>DECLINED {s.declined}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Students table */}
        <section className="bg-white border border-cream-300 rounded-lg overflow-hidden">
          <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 border-b border-cream-300">
            <h2 className="text-xl">Students</h2>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="text-sm bg-cream-100 border border-cream-300 rounded-md px-3 py-1.5"
            >
              <option value="status">Sort by status</option>
              <option value="name">Sort by name</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[12px] uppercase tracking-wide text-ink-300 font-mono">
                  <th className="text-left px-6 py-3 font-normal">Name</th>
                  <th className="text-left px-6 py-3 font-normal hidden sm:table-cell">Email</th>
                  <th className="text-left px-6 py-3 font-normal">Status</th>
                  <th className="text-left px-6 py-3 font-normal">Holland</th>
                  <th className="text-left px-6 py-3 font-normal">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-300">
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-ink-500">
                      No students yet. Share the join link above.
                    </td>
                  </tr>
                )}
                {sorted.map(s => (
                  <tr key={s.id} className="hover:bg-cream-50">
                    <td className="px-6 py-4 font-medium">{s.name}</td>
                    <td className="px-6 py-4 text-ink-500 hidden sm:table-cell">{s.email}</td>
                    <td className="px-6 py-4">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-6 py-4 font-mono text-forest-700">
                      {s.hollandCode ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/portal/counselor/students/${s.id}`} className="text-sm text-forest-700 hover:underline">Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: Student['status'] }) {
  const map = {
    pending: 'bg-cream-200 text-ink-500',
    in_progress: 'bg-terracotta-100 text-terracotta-800',
    complete: 'bg-forest-50 text-forest-700'
  } as const;
  const label = status === 'in_progress' ? 'In progress' : status[0].toUpperCase() + status.slice(1);
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] font-medium ${map[status]}`}>
      {label}
    </span>
  );
}
