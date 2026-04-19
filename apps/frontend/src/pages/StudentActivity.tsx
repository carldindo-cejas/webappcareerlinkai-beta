import { useEffect, useMemo, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { studentNavItems } from '../lib/portalNav';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import MiniCalendar, { CalendarEvent } from '../components/charts/MiniCalendar';

type Invitation = {
  id: number;
  status: 'pending' | 'accepted' | 'declined';
  title: string;
  description?: string;
  scheduledAt: number;
  departmentName: string;
};

function formatDateTime(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function StudentActivity() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const rows = await api<Invitation[]>('/student/invitations');
      setInvitations(rows);
    } catch {
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function respondInvite(id: number, status: 'accepted' | 'declined') {
    setBusyId(id);
    try {
      await api(`/student/invitations/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
    } finally {
      setBusyId(null);
    }
  }

  const events = useMemo<CalendarEvent[]>(
    () => invitations.map(inv => ({
      id: inv.id,
      title: inv.title,
      scheduledAt: inv.scheduledAt,
      subtitle: inv.departmentName
    })),
    [invitations]
  );

  const nowSec = Math.floor(Date.now() / 1000);

  const upcoming = useMemo(() => {
    return [...invitations]
      .filter(inv => inv.status !== 'declined' && inv.scheduledAt >= nowSec)
      .sort((a, b) => a.scheduledAt - b.scheduledAt)[0] || null;
  }, [invitations, nowSec]);

  const totals = useMemo(() => ({
    total: invitations.length,
    joined: invitations.filter(i => i.status === 'accepted').length,
    done: invitations.filter(i => i.status === 'accepted' && i.scheduledAt < nowSec).length,
    declined: invitations.filter(i => i.status === 'declined').length
  }), [invitations, nowSec]);

  return (
    <PortalLayout
      title="Activity"
      subtitle={`Welcome, ${user?.name || 'Student'}`}
      navItems={studentNavItems}
    >
      {upcoming && (
        <section className="bg-forest-700 text-cream-50 rounded-lg p-6 mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="eyebrow !text-terracotta-400 mb-2">Upcoming activity</div>
            <h2 className="text-2xl mb-1">{upcoming.title}</h2>
            <div className="text-cream-200 text-sm">
              {upcoming.departmentName} · {formatDateTime(upcoming.scheduledAt)}
            </div>
            {upcoming.description && (
              <p className="text-cream-200 text-sm mt-2 max-w-xl">{upcoming.description}</p>
            )}
          </div>
          {upcoming.status === 'pending' && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn bg-terracotta-400 text-ink-900 hover:bg-terracotta-500 border-none"
                disabled={busyId === upcoming.id}
                onClick={() => respondInvite(upcoming.id, 'accepted')}
              >
                Accept
              </button>
              <button
                type="button"
                className="btn btn-ghost !text-cream-50 !border-cream-50/40 hover:!bg-white/10"
                disabled={busyId === upcoming.id}
                onClick={() => respondInvite(upcoming.id, 'declined')}
              >
                Decline
              </button>
            </div>
          )}
          {upcoming.status !== 'pending' && (
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-cream-200">
              {upcoming.status}
            </span>
          )}
        </section>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          ['Events', totals.total],
          ['Events joined', totals.joined],
          ['Events done', totals.done],
          ['Events declined', totals.declined]
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white border border-cream-300 rounded-lg p-5">
            <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-2">{label}</div>
            <div className="font-display text-4xl text-forest-700 leading-none">{value}</div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-cream-300 rounded-lg p-6 mb-6">
        <h2 className="text-xl mb-4">Calendar of activities</h2>
        {loading ? (
          <div className="text-ink-500">Loading…</div>
        ) : (
          <MiniCalendar events={events} />
        )}
      </section>

      <section className="bg-white border border-cream-300 rounded-lg p-6">
        <h2 className="text-xl mb-4">Events</h2>
        {loading ? (
          <div className="text-ink-500">Loading events…</div>
        ) : invitations.length === 0 ? (
          <div className="text-ink-500">No activity invitations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">Event</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">Department</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">Date</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">Status</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} className="border-t border-cream-300 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{inv.title}</div>
                      {inv.description && (
                        <div className="text-xs text-ink-500 mt-1 max-w-sm">{inv.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-500">{inv.departmentName}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDateTime(inv.scheduledAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.status === 'pending' ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busyId === inv.id}
                            onClick={() => respondInvite(inv.id, 'accepted')}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busyId === inv.id}
                            onClick={() => respondInvite(inv.id, 'declined')}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
