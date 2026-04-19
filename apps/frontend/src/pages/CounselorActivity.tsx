import { FormEvent, useEffect, useMemo, useState } from 'react';
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

type Seminar = {
  id: number;
  title: string;
  description?: string;
  venue?: string;
  scheduledAt: number;
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
};

type DepartmentDetail = {
  id: number;
  name: string;
  seminars: Seminar[];
};

type ActivityFeed = {
  id: number;
  text: string;
  ago: string;
};

type EventRow = Seminar & { departmentName: string };

type GroupedEvent = {
  key: string;
  title: string;
  description: string;
  venue: string;
  scheduledAt: number;
  departments: EventRow[];
};

type SeminarDetail = {
  id: number;
  title: string;
  description: string;
  venue: string;
  scheduledAt: number;
  department: { id: number; name: string };
  totals: { invited: number; accepted: number; declined: number; pending: number };
  joined: { id: number; name: string; email: string }[];
  notJoining: { id: number; name: string; email: string }[];
  pendingStudents: { id: number; name: string; email: string }[];
};

export default function CounselorActivity() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [details, setDetails] = useState<Record<number, DepartmentDetail>>({});
  const [feed, setFeed] = useState<ActivityFeed[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewEvent, setViewEvent] = useState<GroupedEvent | null>(null);
  const [viewDetails, setViewDetails] = useState<SeminarDetail[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [depts, activity] = await Promise.all([
        api<Department[]>('/counselor/departments'),
        api<ActivityFeed[]>('/counselor/activity')
      ]);
      setDepartments(depts);
      setFeed(activity);
      const entries = await Promise.all(
        depts.map(async d => [d.id, await api<DepartmentDetail>(`/counselor/departments/${d.id}`)] as const)
      );
      setDetails(Object.fromEntries(entries));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const groupedEvents = useMemo<GroupedEvent[]>(() => {
    const rows: EventRow[] = [];
    for (const dept of departments) {
      for (const seminar of details[dept.id]?.seminars || []) {
        rows.push({ ...seminar, departmentName: dept.name });
      }
    }
    rows.sort((a, b) => b.scheduledAt - a.scheduledAt || b.id - a.id);
    // Group by title + scheduledAt + venue + description (created as batch)
    const map = new Map<string, GroupedEvent>();
    for (const r of rows) {
      const key = `${r.title}::${r.scheduledAt}::${r.venue || ''}::${r.description || ''}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          title: r.title,
          description: r.description || '',
          venue: r.venue || '',
          scheduledAt: r.scheduledAt,
          departments: []
        };
        map.set(key, g);
      }
      g.departments.push(r);
    }
    return Array.from(map.values());
  }, [departments, details]);

  function toggleDept(id: number) {
    setSelectedDeptIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function createActivity(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Activity title is required.');
    if (!scheduledAt) return setError('Activity schedule is required.');
    if (selectedDeptIds.length === 0) return setError('Select at least one department.');

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        venue: venue.trim(),
        scheduledAt: new Date(scheduledAt).toISOString()
      };

      await Promise.all(selectedDeptIds.map(deptId =>
        api(`/counselor/departments/${deptId}/seminars`, {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      ));

      setTitle('');
      setDescription('');
      setVenue('');
      setScheduledAt('');
      setSelectedDeptIds([]);
      await load();
    } catch (createErr: any) {
      setError(createErr.message || 'Could not create activity.');
    } finally {
      setSubmitting(false);
    }
  }

  async function openEvent(ev: GroupedEvent) {
    setViewEvent(ev);
    setViewDetails([]);
    setViewLoading(true);
    try {
      const detailList = await Promise.all(
        ev.departments.map(d => api<SeminarDetail>(`/counselor/seminars/${d.id}`))
      );
      setViewDetails(detailList);
    } catch {
      setViewDetails([]);
    } finally {
      setViewLoading(false);
    }
  }

  function closeView() {
    setViewEvent(null);
    setViewDetails([]);
  }

  const viewTotals = useMemo(() => {
    return viewDetails.reduce(
      (acc, d) => ({
        invited: acc.invited + d.totals.invited,
        accepted: acc.accepted + d.totals.accepted,
        declined: acc.declined + d.totals.declined,
        pending: acc.pending + d.totals.pending
      }),
      { invited: 0, accepted: 0, declined: 0, pending: 0 }
    );
  }, [viewDetails]);

  const viewJoined = useMemo(() => viewDetails.flatMap(d => d.joined), [viewDetails]);
  const viewNotJoining = useMemo(() => viewDetails.flatMap(d => d.notJoining), [viewDetails]);

  return (
    <PortalLayout
      title="Events and Activity"
      subtitle="Create activities for selected departments and track accept/reject counts"
      navItems={counselorNavItems}
    >
      <div className="grid xl:grid-cols-[1.1fr_1fr] gap-6">
        <section className="bg-white border border-cream-300 rounded-lg p-6">
          <h2 className="text-xl mb-4">Create Activity</h2>
          <form onSubmit={createActivity} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">Description</label>
              <textarea className="input min-h-24" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Venue</label>
                <input className="input" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. AVR 2, Main Hall" />
              </div>
              <div>
                <label className="block text-sm mb-1">Schedule</label>
                <input className="input" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Invite Departments</label>
              {departments.length === 0 ? (
                <div className="text-sm text-ink-500">No departments available.</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {departments.map(d => (
                    <label key={d.id} className="flex items-center gap-2 text-sm border border-cream-300 rounded p-2">
                      <input type="checkbox" checked={selectedDeptIds.includes(d.id)} onChange={() => toggleDept(d.id)} />
                      <span>{d.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="text-sm text-terracotta-800">{error}</div>}

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create and Invite'}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white border border-cream-300 rounded-lg p-6">
          <h2 className="text-xl mb-4">Recent Activity Feed</h2>
          {loading ? (
            <div className="text-ink-500">Loading…</div>
          ) : feed.length === 0 ? (
            <div className="text-ink-500">No activity yet.</div>
          ) : (
            <div className="space-y-3">
              {feed.map(item => (
                <div key={item.id} className="text-sm border-b border-dashed border-cream-300 pb-3 last:border-0">
                  <div>{item.text}</div>
                  <div className="text-ink-500 mt-1">{item.ago}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white border border-cream-300 rounded-lg p-6 mt-6">
        <h2 className="text-xl mb-4">Invitations and Responses</h2>
        {groupedEvents.length === 0 ? (
          <div className="text-ink-500">No events created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 border-b border-cream-300">
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Summary</th>
                  <th className="py-2 pr-3">Departments</th>
                  <th className="py-2 pr-3 text-right">Invited</th>
                  <th className="py-2 pr-3 text-right">Joined</th>
                  <th className="py-2 pr-3 text-right">Not Joining</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {groupedEvents.map(ev => {
                  const totals = ev.departments.reduce(
                    (acc, s) => ({
                      invited: acc.invited + s.invited,
                      accepted: acc.accepted + s.accepted,
                      declined: acc.declined + s.declined
                    }),
                    { invited: 0, accepted: 0, declined: 0 }
                  );
                  return (
                    <tr key={ev.key} className="border-t border-cream-200 align-top">
                      <td className="py-3 pr-3">
                        <div className="font-medium">{ev.title}</div>
                        <div className="text-xs text-ink-500 mt-1">
                          {new Date(ev.scheduledAt * 1000).toLocaleString()}
                          {ev.venue ? ` · ${ev.venue}` : ''}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-ink-500 max-w-[280px]">
                        <div className="line-clamp-2">{ev.description || '—'}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {ev.departments.map(d => (
                            <span key={d.id} className="text-[11px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 bg-cream-200 rounded">
                              {d.departmentName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right font-mono">{totals.invited}</td>
                      <td className="py-3 pr-3 text-right font-mono text-forest-700">{totals.accepted}</td>
                      <td className="py-3 pr-3 text-right font-mono text-terracotta-600">{totals.declined}</td>
                      <td className="py-3 pr-3 text-right">
                        <button type="button" className="btn btn-ghost text-xs" onClick={() => openEvent(ev)}>View more</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {viewEvent && (
        <div className="fixed inset-0 bg-ink-900/45 z-50 p-4 flex items-center justify-center">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-cream-300">
            <div className="p-6 border-b border-cream-300 flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-1">Activity Details</div>
                <h3 className="text-2xl">{viewEvent.title}</h3>
                <div className="text-sm text-ink-500 mt-1">
                  {new Date(viewEvent.scheduledAt * 1000).toLocaleString()}
                  {viewEvent.venue ? ` · ${viewEvent.venue}` : ''}
                </div>
              </div>
              <button type="button" onClick={closeView} className="btn btn-ghost">Close</button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="eyebrow mb-2">Description</div>
                <p className="text-sm text-ink-500 whitespace-pre-wrap">
                  {viewEvent.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Invited', viewTotals.invited],
                  ['Joined', viewTotals.accepted],
                  ['Not Joining', viewTotals.declined],
                  ['Pending', viewTotals.pending]
                ].map(([label, val]) => (
                  <div key={label as string} className="bg-cream-100 rounded border border-cream-300 p-3 text-center">
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-300">{label}</div>
                    <div className="font-display text-xl text-forest-700">{val}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="eyebrow mb-2">Departments Invited</div>
                <div className="flex flex-wrap gap-2">
                  {viewEvent.departments.map(d => (
                    <span key={d.id} className="text-xs font-mono uppercase tracking-[0.08em] px-2.5 py-1 bg-cream-200 rounded">
                      {d.departmentName}
                    </span>
                  ))}
                </div>
              </div>

              {viewLoading ? (
                <div className="text-ink-500">Loading attendees…</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="eyebrow mb-2">Joined ({viewJoined.length})</div>
                    {viewJoined.length === 0 ? (
                      <div className="text-sm text-ink-500">No one has joined yet.</div>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {viewJoined.map(s => (
                          <li key={`j-${s.id}`} className="border-b border-dashed border-cream-300 pb-1.5 last:border-0">
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-ink-500">{s.email}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="eyebrow mb-2">Not Joining ({viewNotJoining.length})</div>
                    {viewNotJoining.length === 0 ? (
                      <div className="text-sm text-ink-500">No one declined yet.</div>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {viewNotJoining.map(s => (
                          <li key={`n-${s.id}`} className="border-b border-dashed border-cream-300 pb-1.5 last:border-0">
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-ink-500">{s.email}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
