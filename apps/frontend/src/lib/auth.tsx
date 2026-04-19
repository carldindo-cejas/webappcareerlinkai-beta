import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export type User = {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'counselor';
  onboarded: boolean;
  basicsCompleted?: boolean;
};

export type SignUpPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'student' | 'counselor';
  school?: string;
  inviteCode?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, role: 'student' | 'counselor') => Promise<User>;
  signUp: (payload: SignUpPayload) => Promise<User>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>('/auth/me');
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function signIn(email: string, password: string, role: 'student' | 'counselor') {
    const { token, user } = await api<{ token: string; user: User }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });
    setToken(token);
    setUser(user);
    return user;
  }

  async function signUp(payload: SignUpPayload) {
    const name = `${payload.firstName} ${payload.lastName}`.trim();
    const { token, user } = await api<{ token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name,
        firstName: payload.firstName,
        lastName: payload.lastName,
        school: payload.school,
        inviteCode: payload.inviteCode,
        email: payload.email,
        password: payload.password,
        role: payload.role
      })
    });
    setToken(token);
    setUser(user);
    return user;
  }

  function signOut() {
    setToken(null);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, signOut, refresh }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
