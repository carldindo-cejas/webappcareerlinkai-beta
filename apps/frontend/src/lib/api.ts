const TOKEN_KEY = 'careerlinkai_token';
const REFRESH_TOKEN_KEY = 'careerlinkai_refresh_token';
const DEFAULT_PROD_API_BASE = 'https://careerlinkai.cejascarldindo.workers.dev';
const DEFAULT_DEV_API_BASE = 'http://localhost:8787';
const ENV_API_BASE = (import.meta.env.VITE_API_BASE || '').trim();
export const API_BASE = (
  ENV_API_BASE || (import.meta.env.DEV ? DEFAULT_DEV_API_BASE : DEFAULT_PROD_API_BASE)
).replace(/\/$/, '');

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Shared promise so parallel 401s don't fire multiple refresh requests.
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt })
      });
      if (!res.ok) {
        setToken(null);
        setRefreshToken(null);
        return null;
      }
      const data: { token: string; refreshToken: string } = await res.json();
      setToken(data.token);
      setRefreshToken(data.refreshToken);
      return data.token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }

  // On 401, attempt a silent token refresh and retry once.
  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/signin') {
    const newToken = await tryRefresh();
    if (newToken) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set('Content-Type', 'application/json');
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      const retryRes = await fetch(`${API_BASE}${path}`, { ...init, headers: retryHeaders });
      const retryText = await retryRes.text();
      let retryBody: any = null;
      if (retryText) { try { retryBody = JSON.parse(retryText); } catch { retryBody = null; } }
      if (!retryRes.ok) {
        throw new ApiError(retryBody?.error || retryRes.statusText || 'Request failed', retryRes.status);
      }
      return retryBody as T;
    }
  }

  if (!res.ok) {
    throw new ApiError(body?.error || res.statusText || 'Request failed', res.status);
  }
  return body as T;
}
