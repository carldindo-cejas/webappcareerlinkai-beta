import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PortalLayout from '../components/PortalLayout';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { counselorNavItems } from '../lib/portalNav';
import MiniCalendar, { CalendarEvent } from '../components/charts/MiniCalendar';
import DonutChart, { DONUT_PALETTE, type DonutSlice } from '../components/charts/DonutChart';
import RankedBar from '../components/charts/RankedBar';

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

  const events = useMemo<CalendarEvent[]>(
    () => seminars.map(s => ({ id: s.id, title: s.title, scheduledAt: s.scheduledAt, subtitle: s.departmentName })),
    [seminars]
  );

  const nextEvent = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return (
      seminars
        .filter(s => s.scheduledAt > now)
        .sort((a, b) => a.scheduledAt - b.scheduledAt)[0] ?? null
    );
  }, [seminars]);

  const deptSlices = useMemo<DonutSlice[]>(
    () =>
      departments.map((d, i) => ({
        label: d.name,
        value: Math.max(d.students, 1),
        color: DONUT_PALETTE[i % DONUT_PALETTE.length]
      })),
    [departments]
  );

  const totalStudents = stats?.totals.students ?? departments.reduce((sum, d) => sum + d.students, 0);
  const studentBarMax = Math.max(1, ...departments.map(d => d.students));

  const rankedList: RankedItem[] = rankMode === 'careers'
    ? (stats?.topCareers ?? [])
    : (stats?.topCourses ?? []);

  const hollandRanked: RankedItem[] = (stats?.holland ?? []).map(h => ({ name: h.code, count: h.count }));

  return (
    <PortalLayout
      title="Counselor Dashboard"
      subtitle={`Welcome back, ${user?.name || 'Counselor'}`}
      navItems={counselorNavItems}
    >
      {!loading && nextEvent && (
        <div className="mb-6 rounded-lg border border-gold-500/50 bg-gold-500/10 px-5 py-4 flex items-start gap-4">
          <div className="mt-2 w-2 h-2 rounded-full bg-gold-500 shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-gold-500 mb-0.5">Upcoming Activity</div>
            <div className="font-medium text-ink-900 truncate">{nextEvent.title}</div>
            <div className="text-sm text-ink-500 mt-0.5">
              {new Date(nextEvent.scheduledAt * 1000).toLocaleString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit'
              })}
              {' · '}{nextEvent.departmentName}
            </div>
          </div>
          <Link
            to="/portal/counselor/events"
            className="text-xs font-mono uppercase tracking-[0.1em] px-3 py-1.5 border border-gold-500/50 rounded hover:bg-gold-500/20 text-gold-500 shrink-0"
          >
            View
          </Link>
        </div>
      )}

      <section className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-cream-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl">Departments Handled</h2>
              <p className="text-sm text-ink-500 mt-0.5">Student distribution across departments</p>
            </div>
            <Link to="/portal/counselor/departments" className="text-sm text-forest-700 hover:underline">Manage</Link>
          </div>
          {loading ? (
            <div className="text-ink-500">Loading…</div>
          ) : departments.length === 0 ? (
            <div className="text-ink-500">No departments yet.</div>
          ) : (
            <div className="flex items-center gap-5 flex-wrap">
              <DonutChart
                slices={deptSlices}
                size={180}
                centerLabel={String(departments.length)}
                centerSub={departments.length === 1 ? 'Dept' : 'Depts'}
              />
              <ul className="space-y-2 text-sm flex-1 min-w-[140px]">
                {deptSlices.map((s, i) => {
                  const pct = totalStudents
                    ? Math.round((departments[i].students / totalStudents) * 100)
                    : 0;
                  return (
                    <li key={s.label} className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="truncate flex-1" title={s.label}>{s.label}</span>
                      <span className="font-mono text-[11px] text-ink-500 shrink-0">
                        {departments[i].students} · {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white border border-cream-300 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl">Students</h2>
            <p className="text-sm text-ink-500 mt-0.5">Enrolled students per department</p>
          </div>
          {loading ? (
            <div className="text-ink-500">Loading…</div>
          ) : departments.length === 0 ? (
            <div className="text-ink-500">No departments yet.</div>
          ) : (
            <div className="space-y-2.5">
              {departments.map(d => {
                const pct = (d.students / studentBarMax) * 100;
                return (
                  <div key={d.id}>
                    <div className="flex justify-between text-sm mb-1 gap-2">
                      <span className="truncate" title={d.name}>{d.name}</span>
                      <span className="font-mono text-ink-500 shrink-0">{d.students}</span>
                    </div>
                    <div className="h-2.5 bg-cream-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-forest-700 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-1 text-sm text-ink-500 font-mono">
                Total: <span className="text-forest-700 font-semibold">{totalStudents}</span>
              </div>
            </div>
          )}
        </div>
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
          ) : (
            <RankedBar items={rankedList} maxItems={5} emptyText="No predictions yet." />
          )}
        </div>

        <div className="bg-white border border-cream-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl">Top Holland Codes</h2>
            <Link to="/portal/counselor/analytics" className="text-sm text-forest-700 hover:underline">Details</Link>
          </div>
          {loading ? (
            <div className="text-ink-500">Loading…</div>
          ) : (
            <RankedBar items={hollandRanked} maxItems={5} emptyText="No results yet." />
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
