import { FormEvent, useEffect, useMemo, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { api } from '../lib/api';
import { counselorNavItems } from '../lib/portalNav';
import { STRANDS } from '../data/strands';

type Department = {
  id: number;
  name: string;
  strand: string;
  students: number;
  completed: number;
  joinCode: string;
  joinUrl?: string;
};

type DepartmentStudent = {
  id: number;
  name: string;
  email: string;
  status: 'pending' | 'in_progress' | 'complete';
  hollandCode?: string | null;
  topCareer?: string | null;
  topCourse?: string | null;
  bestSubject?: string | null;
  selfEfficacy?: number | null;
  outcomeExpectation?: number | null;
  perceivedBarriers?: number | null;
};

type DepartmentDetail = {
  id: number;
  name: string;
  strand: string;
  joinCode: string;
  joinUrl: string;
  students: DepartmentStudent[];
};

function CopyButton({ value, label }: { value: string; label: string }) {
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

function formatMetric(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toFixed(2);
}

export default function CounselorDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [details, setDetails] = useState<Record<number, DepartmentDetail>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newStrand, setNewStrand] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [created, setCreated] = useState<Department | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadDepartments() {
    setLoading(true);
    try {
      const data = await api<Department[]>('/counselor/departments');
      setDepartments(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  async function refreshDetail(deptId: number) {
    const detail = await api<DepartmentDetail>(`/counselor/departments/${deptId}`);
    setDetails(prev => ({ ...prev, [deptId]: detail }));
  }

  async function toggleDepartment(deptId: number) {
    setExpanded(prev => ({ ...prev, [deptId]: !prev[deptId] }));
    if (details[deptId]) return;
    await refreshDetail(deptId);
  }

  async function createDepartment(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!newStrand) return setErr('Choose a strand first.');
    if (!newName.trim()) return setErr('Department name is required.');
    const finalName = `${newStrand} ${newName.trim()}`;
    try {
      const dept = await api<Department>('/counselor/departments', {
        method: 'POST',
        body: JSON.stringify({ name: finalName, strand: newStrand })
      });
      setCreated(dept);
      setNewName('');
      setNewStrand('');
      setShowNew(false);
      await loadDepartments();
    } catch (createErr: any) {
      setErr(createErr.message || 'Could not create department.');
    }
  }

  async function removeStudent(deptId: number, studentId: number) {
    if (!confirm('Remove this student from the department?')) return;
    try {
      await api(`/counselor/departments/${deptId}/students/${studentId}`, { method: 'DELETE' });
      await Promise.all([refreshDetail(deptId), loadDepartments()]);
    } catch (e: any) {
      alert(e.message || 'Could not remove student.');
    }
  }

  const createdJoinUrl = useMemo(() => {
    if (!created) return '';
    return created.joinUrl || `${window.location.origin}/join/${created.joinCode}`;
  }, [created]);

  const previewName = newStrand && newName.trim() ? `${newStrand} ${newName.trim()}` : '';

  return (
    <PortalLayout
      title="Departments"
      subtitle="Create departments, share invitation code/link, and view students per department"
      navItems={counselorNavItems}
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={() => setShowNew(true)} className="btn btn-primary">+ Create Department</button>
        </div>
        {created && (
          <section className="bg-white border border-cream-300 rounded-lg p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl mb-1">Department created</h2>
                <p className="text-sm text-ink-500">Share the invitation code or join link with students.</p>
              </div>
              <button type="button" onClick={() => setCreated(null)} className="btn btn-ghost">Dismiss</button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div><strong>Name:</strong> {created.name}</div>
              <div><strong>Invitation Code:</strong> <span className="font-mono">{created.joinCode}</span></div>
              <div className="break-all"><strong>Join URL:</strong> {createdJoinUrl}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton label="Copy Link" value={createdJoinUrl} />
              <CopyButton label="Copy Code" value={created.joinCode} />
            </div>
          </section>
        )}

        <section className="bg-white border border-cream-300 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-cream-300 flex items-center justify-between">
            <h2 className="text-xl">All Departments</h2>
            <span className="text-sm text-ink-500">{departments.length} total</span>
          </div>

          {loading ? (
            <div className="p-6 text-ink-500">Loading…</div>
          ) : departments.length === 0 ? (
            <div className="p-6 text-ink-500">No departments yet.</div>
          ) : (
            <div className="divide-y divide-cream-300">
              {departments.map(dept => {
                const detail = details[dept.id];
                const isOpen = !!expanded[dept.id];
                const joinUrl = dept.joinUrl || `${window.location.origin}/join/${dept.joinCode}`;
                return (
                  <div
                    key={dept.id}
                    className="p-4 sm:p-6 cursor-pointer hover:bg-cream-50 transition-colors"
                    onClick={() => toggleDepartment(dept.id)}
                  >
                    <div className="flex flex-wrap justify-between gap-3 items-start">
                      <div className="text-left">
                        <div className="font-medium flex items-center gap-2">
                          {dept.name}
                          <span className="text-xs text-ink-500 font-normal">{isOpen ? '▲' : '▼'}</span>
                        </div>
                        <div className="text-sm text-ink-500 mt-1">Code <span className="font-mono">{dept.joinCode}</span> · {dept.strand}</div>
                      </div>
                      <div
                        className="flex items-center gap-3 flex-wrap"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="text-sm text-ink-500">{dept.students} students · {dept.completed} completed</div>
                        <CopyButton label="Copy Link" value={joinUrl} />
                        <CopyButton label="Copy Code" value={dept.joinCode} />
                      </div>
                    </div>

                    {isOpen && detail && (
                      <div className="mt-4 border-t border-cream-300 pt-4" onClick={e => e.stopPropagation()}>
                        <div className="text-sm text-ink-500 mb-3 break-all">Join URL: {detail.joinUrl}</div>
                        {detail.students.length === 0 ? (
                          <div className="text-sm text-ink-500">No students joined yet.</div>
                        ) : (
                          <div className="overflow-x-auto max-h-[570px] overflow-y-auto">
                            <table className="w-full text-sm min-w-[960px]">
                              <thead className="sticky top-0 bg-white z-10">
                                <tr className="text-left text-ink-500 border-b border-cream-300">
                                  <th className="py-2 pr-3">Name</th>
                                  <th className="py-2 pr-3">Email</th>
                                  <th className="py-2 pr-3">Status</th>
                                  <th className="py-2 pr-3">Career</th>
                                  <th className="py-2 pr-3">Course</th>
                                  <th className="py-2 pr-3">Best Subject</th>
                                  <th className="py-2 pr-3">Holland</th>
                                  <th className="py-2 pr-3 text-right">Self-Eff.</th>
                                  <th className="py-2 pr-3 text-right">Outcome Exp.</th>
                                  <th className="py-2 pr-3 text-right">Barriers</th>
                                  <th className="py-2 pr-3"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.students.map(student => {
                                  const statusStyle =
                                    student.status === 'complete'
                                      ? 'bg-forest-100 text-forest-700'
                                      : student.status === 'in_progress'
                                      ? 'bg-gold-500/15 text-gold-500'
                                      : 'bg-terracotta-100 text-terracotta-600';
                                  const statusLabel =
                                    student.status === 'complete'
                                      ? 'Completed'
                                      : student.status === 'in_progress'
                                      ? 'In Progress'
                                      : 'Pending';
                                  return (
                                    <tr key={student.id} className="border-t border-cream-200 align-top">
                                      <td className="py-2 pr-3">{student.name}</td>
                                      <td className="py-2 pr-3 text-ink-500">{student.email}</td>
                                      <td className="py-2 pr-3">
                                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${statusStyle}`}>
                                          {statusLabel}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-3">{student.topCareer || '—'}</td>
                                      <td className="py-2 pr-3">{student.topCourse || '—'}</td>
                                      <td className="py-2 pr-3">{student.bestSubject || '—'}</td>
                                      <td className="py-2 pr-3 font-mono text-forest-700">{student.hollandCode || '—'}</td>
                                      <td className="py-2 pr-3 text-right font-mono">{formatMetric(student.selfEfficacy)}</td>
                                      <td className="py-2 pr-3 text-right font-mono">{formatMetric(student.outcomeExpectation)}</td>
                                      <td className="py-2 pr-3 text-right font-mono">{formatMetric(student.perceivedBarriers)}</td>
                                      <td className="py-2 pr-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => removeStudent(dept.id, student.id)}
                                          className="text-xs text-terracotta-600 hover:text-terracotta-800 underline"
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-ink-900/45 z-50 p-4 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md border border-cream-300">
            <h3 className="text-xl mb-1">Create Department</h3>
            <p className="text-sm text-ink-500 mb-5">Choose the strand first, then the department name. The final name becomes <em>Strand + Name</em>.</p>
            <form onSubmit={createDepartment} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Strand</label>
                <select className="input" value={newStrand} onChange={e => setNewStrand(e.target.value)} required>
                  <option value="">Choose a strand</option>
                  {STRANDS.map(s => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Department Name</label>
                <input
                  className="input"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Section Aurora"
                  required
                  disabled={!newStrand}
                />
              </div>
              {previewName && (
                <div className="text-sm text-ink-500">
                  Final name: <span className="font-medium text-ink-900">{previewName}</span>
                </div>
              )}
              {err && <div className="text-sm text-terracotta-800">{err}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowNew(false); setErr(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
