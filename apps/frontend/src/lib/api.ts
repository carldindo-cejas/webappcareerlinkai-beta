const TOKEN_KEY = 'careerlinkai_token';
const DEFAULT_PROD_API_BASE = 'https://careerlinkai.cejascarldindo.workers.dev';
const DEFAULT_DEV_API_BASE = 'http://localhost:8787';
const ENV_API_BASE = (import.meta.env.VITE_API_BASE || '').trim();
const API_BASE = (
  ENV_API_BASE || (import.meta.env.DEV ? DEFAULT_DEV_API_BASE : DEFAULT_PROD_API_BASE)
).replace(/\/$/, '');

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    throw new ApiError(body?.error || res.statusText || 'Request failed', res.status);
  }
  return body as T;
}
