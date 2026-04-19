import { useEffect, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { studentNavItems } from '../lib/portalNav';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type DepartmentMember = {
  id: number;
  name: string;
  topCareer: string | null;
  topCourse: string | null;
};

type Department = {
  id: number;
  name: string;
  strand: string;
  joinCode: string;
  counselorName: string;
  students: number;
  completed: number;
  members: DepartmentMember[];
};

export default function StudentDepartments() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Department[]>('/student/departments')
      .then(setDepartments)
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PortalLayout
      title="Department"
      subtitle={`Welcome, ${user?.name || 'Student'}`}
      navItems={studentNavItems}
    >
      <section className="bg-white border border-cream-300 rounded-lg p-6">
        <h2 className="text-xl mb-4">My Departments</h2>

        {loading ? (
          <div className="text-ink-500">Loading departments…</div>
        ) : departments.length === 0 ? (
          <div className="text-ink-500">You have not joined a department yet.</div>
        ) : (
          <div className="space-y-6">
            {departments.map(d => (
              <div key={d.id} className="border border-cream-300 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-cream-100 text-left">
                      <tr>
                        <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">Department</th>
                        <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">Counselor</th>
                        <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">Strand</th>
                        <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-cream-300">
                        <td className="px-4 py-3 font-medium">{d.name}</td>
                        <td className="px-4 py-3">{d.counselorName}</td>
                        <td className="px-4 py-3">{d.strand}</td>
                        <td className="px-4 py-3">{d.students}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-cream-300">
                  <div className="px-4 pt-4 pb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
                    Members
                  </div>
                  {d.members.length === 0 ? (
                    <div className="px-4 pb-4 text-ink-500 text-sm">No members yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-cream-50 text-left">
                          <tr>
                            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">Name</th>
                            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">Career</th>
                            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">Course</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.members.map(m => (
                            <tr key={m.id} className="border-t border-cream-300">
                              <td className="px-4 py-2 font-medium">{m.name}</td>
                              <td className="px-4 py-2 text-ink-500">{m.topCareer || '—'}</td>
                              <td className="px-4 py-2 text-ink-500">{m.topCourse || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
