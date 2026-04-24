import { useEffect, useRef, useState } from 'react';
import { useNotifications, type Notification } from '../lib/NotificationContext';

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationItem({ n }: { n: Notification }) {
  return (
    <div className={`px-4 py-3 border-b border-cream-200 last:border-b-0 ${n.read ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-900 leading-snug">{n.title}</p>
        <span className="text-[11px] text-ink-300 shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
      </div>
      <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{n.body}</p>
    </div>
  );
}

export default function NotificationBell() {
  const { notifications, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
  };

  const handleMarkAll = async () => {
    await markAllRead();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative w-9 h-9 inline-flex items-center justify-center rounded border border-cream-300 bg-white text-ink-700 hover:bg-cream-50 transition"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta-600 text-white text-[10px] font-mono font-bold leading-[18px] text-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-cream-300 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200">
            <span className="text-sm font-medium text-ink-900">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-forest-600 hover:text-forest-700 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-300">No notifications yet</div>
            ) : (
              notifications.map(n => <NotificationItem key={n.id} n={n} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
