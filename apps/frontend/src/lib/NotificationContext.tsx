import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { api, API_BASE, getToken } from './api';

export type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  read: number;
  createdAt: number;
};

type ContextValue = {
  notifications: Notification[];
  unread: number;
  markAllRead: () => Promise<void>;
  lastNotification: Notification | null;
};

export const NotificationContext = createContext<ContextValue>({
  notifications: [],
  unread: 0,
  markAllRead: async () => {},
  lastNotification: null,
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnread(0);
      return;
    }

    api<{ unread: number; notifications: Notification[] }>('/notifications')
      .then(r => {
        setNotifications(r.notifications);
        setUnread(r.unread);
      })
      .catch(() => {});

    const token = getToken();
    if (!token) return;

    const wsBase = API_BASE.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/ws/notifications?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = e => {
      try {
        const n = JSON.parse(e.data) as Notification;
        setNotifications(prev => [n, ...prev]);
        setUnread(prev => prev + 1);
        setLastNotification(n);
      } catch { /* ignore malformed messages */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [user?.id]);

  const markAllRead = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unread, markAllRead, lastNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
