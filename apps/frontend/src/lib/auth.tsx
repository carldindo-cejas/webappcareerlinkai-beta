import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, ApiError, getToken, setToken, setRefreshToken, getRefreshToken } from './api';

export type User = {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'counselor';
  onboarded: boolean;
  basicsCompleted?: boolean;
  emailVerified?: boolean;
};

export type SignUpPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'student' | 'counselor';
  school?: string;
  inviteCode?: string;
  acceptedPolicies: boolean;
};

export type SignUpResult = {
  verificationRequired: true;
  email: string;
  emailDelivered?: boolean;
  verifyUrl?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, role: 'student' | 'counselor') => Promise<User>;
  signUp: (payload: SignUpPayload) => Promise<SignUpResult>;
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
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function signIn(email: string, password: string, role: 'student' | 'counselor') {
    const { token, refreshToken, user } = await api<{ token: string; refreshToken: string; user: User }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });
    setToken(token);
    setRefreshToken(refreshToken);
    setUser(user);
    return user;
  }

  async function signUp(payload: SignUpPayload): Promise<SignUpResult> {
    const name = `${payload.firstName} ${payload.lastName}`.trim();
    const res = await api<SignUpResult>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name,
        firstName: payload.firstName,
        lastName: payload.lastName,
        school: payload.school,
        inviteCode: payload.inviteCode,
        acceptedPolicies: payload.acceptedPolicies,
        email: payload.email,
        password: payload.password,
        role: payload.role
      })
    });
    return res;
  }

  function signOut() {
    const rt = getRefreshToken();
    if (rt) {
      api('/auth/signout', { method: 'POST', body: JSON.stringify({ refreshToken: rt }) }).catch(() => {});
    }
    setToken(null);
    setRefreshToken(null);
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
