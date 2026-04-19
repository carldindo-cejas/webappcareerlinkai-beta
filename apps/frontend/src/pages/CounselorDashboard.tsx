import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PortalLayout from '../components/PortalLayout';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { counselorNavItems } from '../lib/portalNav';
import MiniCalendar, { CalendarEvent } from '../components/charts/MiniCalendar';

type Department = {
  id: number;
  name: string;
  strand: string;
  students: number;
  completed: number;
  joinCode: string;
  joinUrl?: string;
};

type RankedItem = { name: string; count: number };
type HollandItem = { code: string; count: number };

type Stats = {
  totals: {
    departments: number;
    students: number;
    completed: number;
    topHolland?: string | null;
    topCareer?: string | null;
    topCourse?: string | null;
  };
  holland: HollandItem[];
  topCareers: RankedItem[];
  topCourses: RankedItem[];
  strands: { strand: string; students: number; completed: number }[];
};

type Seminar = {
  id: number;
  title: string;
  description?: string;
  scheduledAt: number;
  departmentId: number;
  departmentName: string;
  invited: number;
  accepted: number;
};

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="text-xs font-mono uppercase tracking-[0.1em] px-2.5 py-1.5 border border-cream-300 rounded hover:bg-cream-100 text-forest-700"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

export default function CounselorDashboard() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankMode, setRankMode] = useState<'careers' | 'courses'>('careers');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [d, s, se] = await Promise.all([
          api<Department[]>('/counselor/departments'),
          api<Stats>('/counselor/stats'),
          api<Seminar[]>('/counselor/seminars')
        ]);
        setDepartments(d);
        setStats(s);
        setSeminars(se);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const metrics = useMemo(() => {
    const students = stats?.totals.students ?? departments.reduce((sum, d) => sum + d.students, 0);
    return {
      departments: stats?.totals.departments ?? departments.length,
      students,
      topHolland: stats?.totals.topHolland ?? (stats?.holland?.[0]?.code ?? '—'),
      topCareer: stats?.totals.topCareer ?? (stats?.topCareers?.[0]?.name ?? '—')
    };
  }, [departments, stats]);

  const events = useMemo<CalendarEvent[]>(
    () => seminars.map(s => ({ id: s.id, title: s.title, scheduledAt: s.scheduledAt, subtitle: s.departmentName })),
    [seminars]
  );

  const rankedList = rankMode === 'careers' ? (stats?.topCareers ?? []) : (stats?.topCourses ?? []);
  const hollandList = stats?.holland ?? [];

  return (
    <PortalLayout
      title="Counselor Dashboard"
      subtitle={`Welcome back, ${user?.name || 'Counselor'}`}
      navItems={counselorNavItems}
    >
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          ['Departments Handled', metrics.departments],
          ['Students', metrics.students],
          ['Top Holland Code', metrics.topHolland ?? '—'],
          ['Top Career', metrics.topCareer ?? '—']
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white border border-cream-300 rounded-lg p-5">
            <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-2">{label}</div>
            <div className="font-display text-2xl lg:text-3xl text-forest-700 leading-tight truncate" title={String(value)}>
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-[1.3fr_1fr] gap-6 mb-6">
        <div className="bg-white border border-cream-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-xl">Top {rankMode === 'careers' ? 'Careers' : 'Courses'}</h2>
            <div className="inline-flex items-center bg-cream-200 p-1 rounded-md text-xs font-medium">
              <button
                type="button"
                onClick={() => setRankMode('careers')}
                className={`px-3 py-1.5 rounded ${rankMode === 'careers' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
              >
                Top Careers
              </button>
              <button
                type="button"
                onClick={() => setRankMode('courses')}
                className={`px-3 py-1.5 rounded ${rankMode === 'courses' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
              >
                Top Courses
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-ink-500">Loading…</div>
          ) : rankedList.length === 0 ? (
            <div className="text-ink-500">No predictions yet.</div>
          ) : (
            <ol className="space-y-2">
              {rankedList.map((item, idx) => (
                <li key={item.name} className="flex justify-between items-center gap-3 border-b border-dashed border-cream-300 pb-2 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-ink-300 w-6 shrink-0">#{idx + 1}</span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-mono text-sm text-forest-700 shrink-0">{item.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="bg-white border border-cream-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl">Top Holland Codes</h2>
            <Link to="/portal/counselor/analytics" className="text-sm text-forest-700 hover:underline">Details</Link>
          </div>
          {loading ? (
            <div className="text-ink-500">Loading…</div>
          ) : hollandList.length === 0 ? (
            <div className="text-ink-500">No results yet.</div>
          ) : (
            <ol className="space-y-2">
              {hollandList.map((h, idx) => (
                <li key={h.code} className="flex justify-between items-center gap-3 border-b border-dashed border-cream-300 pb-2 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-ink-300 w-6 shrink-0">#{idx + 1}</span>
                    <span className="font-mono text-forest-700">{h.code}</span>
                  </div>
                  <span className="font-mono text-sm text-ink-500 shrink-0">{h.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="grid lg:grid-cols-[1fr_1.2fr] gap-6 mb-6">
        <div className="bg-white border border-cream-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl">Events calendar</h2>
            <Link to="/portal/counselor/events" className="text-sm text-forest-700 hover:underline">All events</Link>
          </div>
          {loading ? (
            <div className="text-ink-500">Loading…</div>
          ) : (
            <MiniCalendar events={events} />
          )}
        </div>

        <div className="bg-white border border-cream-300 rounded-lg p-6">
          <h2 className="text-xl mb-4">Department completion</h2>
          {loading || !stats ? (
            <div className="text-ink-500">Loading…</div>
          ) : stats.strands.length === 0 ? (
            <div className="text-ink-500">No departments yet.</div>
          ) : (
            <div className="space-y-4">
              {stats.strands.map(row => {
                const pct = row.students ? Math.round((row.completed / row.students) * 100) : 0;
                return (
                  <div key={row.strand}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{row.strand}</span>
                      <span className="font-mono text-ink-500">{row.completed}/{row.students} · {pct}%</span>
                    </div>
                    <div className="h-2 bg-cream-200 rounded overflow-hidden flex">
                      <div className="h-full bg-forest-700" style={{ width: `${pct}%` }} />
                      <div className="h-full bg-terracotta-300" style={{ width: `${100 - pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white border border-cream-300 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl">Recent Departments</h2>
          <Link to="/portal/counselor/departments" className="text-sm text-forest-700 hover:underline">Manage</Link>
        </div>
        {loading ? (
          <div className="text-ink-500">Loading…</div>
        ) : departments.length === 0 ? (
          <div className="text-ink-500">No departments yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {departments.slice(0, 6).map(d => {
              const joinUrl = d.joinUrl || `${window.location.origin}/join/${d.joinCode}`;
              return (
                <div key={d.id} className="border border-cream-300 rounded-lg p-4">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-ink-500 mt-1">Code {d.joinCode} · {d.students} students</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton label="Copy Link" value={joinUrl} />
                    <CopyButton label="Copy Code" value={d.joinCode} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
