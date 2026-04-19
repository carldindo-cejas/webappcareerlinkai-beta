import { useEffect, useMemo, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { counselorNavItems } from '../lib/portalNav';
import { api } from '../lib/api';

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
    const strandCounts: Record<string, number> = {};
    const hollandCounts: Record<string, number> = {};

    for (const d of departments) {
      strandCounts[d.strand] = (strandCounts[d.strand] || 0) + d.students;
      const detail = details[d.id];
      for (const s of detail?.students || []) {
        if (!s.hollandCode) continue;
        hollandCounts[s.hollandCode] = (hollandCounts[s.hollandCode] || 0) + 1;
      }
    }

    const topHolland = Object.entries(hollandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      totalStudents,
      totalCompleted,
      completionRate: totalStudents ? Math.round((totalCompleted / totalStudents) * 100) : 0,
      strandCounts,
      topHolland
    };
  }, [departments, details]);

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
              <h2 className="text-xl mb-4">Students by Strand</h2>
              <div className="space-y-3">
                {Object.entries(summary.strandCounts).map(([strand, count]) => {
                  const pct = summary.totalStudents ? Math.round((count / summary.totalStudents) * 100) : 0;
                  return (
                    <div key={strand}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{strand}</span>
                        <span className="font-mono text-ink-500">{count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-cream-200 rounded overflow-hidden">
                        <div className="h-full bg-forest-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-cream-300 rounded-lg p-6">
              <h2 className="text-xl mb-4">Top Holland Codes</h2>
              {summary.topHolland.length === 0 ? (
                <div className="text-ink-500">No completed results yet.</div>
              ) : (
                <div className="space-y-2">
                  {summary.topHolland.map(([code, count]) => (
                    <div key={code} className="flex justify-between text-sm border-b border-dashed border-cream-300 pb-2 last:border-0">
                      <span className="font-mono text-forest-700">{code}</span>
                      <span className="text-ink-500">{count} students</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </PortalLayout>
  );
}
