import { useEffect, useMemo, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { counselorNavItems } from '../lib/portalNav';
import { api } from '../lib/api';
import SharedDonutChart, { DONUT_PALETTE } from '../components/charts/DonutChart';

type Department = {
  id: number;
  name: string;
  strand: string;
  students: number;
  completed: number;
  joinCode: string;
};

type DepartmentStudent = {
  id: number;
  name: string;
  email: string;
  status: 'pending' | 'in_progress' | 'complete';
  hollandCode?: string;
};

type DepartmentDetail = {
  id: number;
  students: DepartmentStudent[];
};

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarPoint(cx, cy, r, endDeg);
  const end = polarPoint(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

type PieSlice = { label: string; value: number; color: string };

function PieChart({ slices, size = 180 }: { slices: PieSlice[]; size?: number }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  if (total === 0) {
    return (
      <svg width={size} height={size} role="img" aria-label="Empty chart">
        <circle cx={cx} cy={cy} r={r} fill="#F0EADF" />
      </svg>
    );
  }

  let acc = 0;
  const paths = slices.map((s, i) => {
    const startDeg = (acc / total) * 360;
    acc += s.value;
    const endDeg = (acc / total) * 360;
    // Full-circle fallback
    if (slices.length === 1 || (endDeg - startDeg) >= 359.999) {
      return <circle key={i} cx={cx} cy={cy} r={r} fill={s.color} />;
    }
    return <path key={i} d={arcPath(cx, cy, r, startDeg, endDeg)} fill={s.color} />;
  });

  return (
    <svg width={size} height={size} role="img" aria-label="Pie chart">
      {paths}
    </svg>
  );
}


function PercentRing({ percent, size = 200 }: { percent: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, percent));
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter * 0.62;

  return (
    <div className="relative inline-block">
      <svg width={size} height={size} role="img" aria-label={`Completion ${pct}%`}>
        <circle cx={cx} cy={cy} r={rOuter} fill="#F0EADF" />
        {pct > 0 && pct < 100 && (
          <path d={arcPath(cx, cy, rOuter, 0, (pct / 100) * 360)} fill="#194D3B" />
        )}
        {pct >= 100 && <circle cx={cx} cy={cy} r={rOuter} fill="#194D3B" />}
        <circle cx={cx} cy={cy} r={rInner} fill="#ffffff" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <div className="font-display text-4xl text-forest-700 leading-none">{pct}%</div>
        <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-500 mt-1">Completed</div>
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const rowH = 34;
  const gap = 8;
  const leftPad = 140;
  const rightPad = 48;
  const width = 520;
  const height = data.length * (rowH + gap) + 8;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Students per department">
      {data.map((d, i) => {
        const y = i * (rowH + gap) + 4;
        const barWidth = ((width - leftPad - rightPad) * d.value) / max;
        return (
          <g key={d.label}>
            <text
              x={leftPad - 10}
              y={y + rowH / 2 + 4}
              textAnchor="end"
              fill="#3A3428"
              fontSize={12}
              style={{ fontFamily: 'Geist, system-ui, sans-serif' }}
            >
              {d.label.length > 22 ? d.label.slice(0, 21) + '…' : d.label}
            </text>
            <rect x={leftPad} y={y} width={width - leftPad - rightPad} height={rowH} fill="#F0EADF" rx={4} />
            <rect x={leftPad} y={y} width={barWidth} height={rowH} fill="#194D3B" rx={4} />
            <text
              x={leftPad + barWidth + 6}
              y={y + rowH / 2 + 4}
              fill="#194D3B"
              fontSize={12}
              fontWeight={600}
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CounselorAnalytics() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [details, setDetails] = useState<Record<number, DepartmentDetail>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const depts = await api<Department[]>('/counselor/departments');
        setDepartments(depts);
        const entries = await Promise.all(
          depts.map(async d => [d.id, await api<DepartmentDetail>(`/counselor/departments/${d.id}`)] as const)
        );
        setDetails(Object.fromEntries(entries));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const summary = useMemo(() => {
    const totalStudents = departments.reduce((sum, d) => sum + d.students, 0);
    const totalCompleted = departments.reduce((sum, d) => sum + d.completed, 0);
    return {
      totalStudents,
      totalCompleted,
      notCompleted: Math.max(0, totalStudents - totalCompleted),
      completionRate: totalStudents ? Math.round((totalCompleted / totalStudents) * 100) : 0
    };
  }, [departments, details]);

  const deptSlices: PieSlice[] = useMemo(
    () =>
      departments
        .filter(d => d.students > 0)
        .map((d, i) => ({
          label: d.name,
          value: d.students,
          color: DONUT_PALETTE[i % DONUT_PALETTE.length]
        })),
    [departments]
  );

  const barData = useMemo(
    () => departments.map(d => ({ label: d.name, value: d.students })),
    [departments]
  );

  const completedSlices: PieSlice[] = [
    { label: 'Completed', value: summary.totalCompleted, color: '#194D3B' },
    { label: 'Not Completed', value: summary.notCompleted, color: '#DDD5C4' }
  ];

  const completedPct = summary.totalStudents
    ? Math.round((summary.totalCompleted / summary.totalStudents) * 100)
    : 0;
  const notCompletedPct = summary.totalStudents ? 100 - completedPct : 0;

  return (
    <PortalLayout
      title="Analytics"
      subtitle="Student summaries and assessment completion insights"
      navItems={counselorNavItems}
    >
      {loading ? (
        <div className="text-ink-500">Loading analytics…</div>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Departments', departments.length],
              ['Students', summary.totalStudents],
              ['Completed', summary.totalCompleted],
              ['Completion', `${summary.completionRate}%`]
            ].map(([label, value]) => (
              <div key={label as string} className="bg-white border border-cream-300 rounded-lg p-5">
                <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-2">{label}</div>
                <div className="font-display text-4xl text-forest-700 leading-none">{value}</div>
              </div>
            ))}
          </section>

          <section className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-1">Departments</h2>
              <p className="text-sm text-ink-500 mb-4">Share of students across each department.</p>
              {departments.length === 0 || summary.totalStudents === 0 ? (
                <div className="text-ink-500">No department data yet.</div>
              ) : (
                <div className="flex items-center gap-6 flex-wrap">
                  <SharedDonutChart
                    slices={deptSlices}
                    centerLabel={String(departments.length)}
                    centerSub={departments.length === 1 ? 'Department' : 'Departments'}
                  />
                  <ul className="space-y-2 text-sm flex-1 min-w-[160px]">
                    {deptSlices.map(s => {
                      const pct = summary.totalStudents
                        ? Math.round((s.value / summary.totalStudents) * 100)
                        : 0;
                      return (
                        <li key={s.label} className="flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="truncate" title={s.label}>{s.label}</span>
                          <span className="ml-auto font-mono text-ink-500 text-xs">
                            {s.value} · {pct}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-1">Students per Department</h2>
              <p className="text-sm text-ink-500 mb-4">Number of students enrolled in each department.</p>
              {barData.length === 0 ? (
                <div className="text-ink-500">No department data yet.</div>
              ) : (
                <BarChart data={barData} />
              )}
            </div>
          </section>

          <section className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-1">Assessment Status</h2>
              <p className="text-sm text-ink-500 mb-4">Completed vs not-completed student assessments.</p>
              {summary.totalStudents === 0 ? (
                <div className="text-ink-500">No student data yet.</div>
              ) : (
                <div className="flex items-center gap-6 flex-wrap">
                  <PieChart slices={completedSlices} size={200} />
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-sm bg-forest-700" />
                      <span>Completed</span>
                      <span className="ml-3 font-mono text-ink-500 text-xs">
                        {summary.totalCompleted} · {completedPct}%
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ backgroundColor: '#DDD5C4' }}
                      />
                      <span>Not Completed</span>
                      <span className="ml-3 font-mono text-ink-500 text-xs">
                        {summary.notCompleted} · {notCompletedPct}%
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-1">Completion Percentage</h2>
              <p className="text-sm text-ink-500 mb-4">Overall share of students who finished the assessment.</p>
              {summary.totalStudents === 0 ? (
                <div className="text-ink-500">No student data yet.</div>
              ) : (
                <div className="flex items-center gap-6 flex-wrap">
                  <PercentRing percent={summary.completionRate} />
                  <div className="text-sm text-ink-500 space-y-1">
                    <div>
                      <span className="font-mono text-forest-700">{summary.totalCompleted}</span> of{' '}
                      <span className="font-mono">{summary.totalStudents}</span> students have completed the assessment.
                    </div>
                    <div>
                      <span className="font-mono text-ink-500">{summary.notCompleted}</span> still pending.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </PortalLayout>
  );
}
