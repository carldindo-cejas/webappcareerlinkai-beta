import { SignJWT, jwtVerify } from 'jose';

export type JwtPayload = {
  sub: string; // user id
  role: 'student' | 'counselor';
  email: string;
};

function encoder(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JwtPayload, secret: string): Promise<string> {
  return await new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(encoder(secret));
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encoder(secret));
    if (!payload.sub || !payload.role) return null;
    return { sub: payload.sub, role: payload.role as any, email: (payload.email as string) ?? '' };
  } catch {
    return null;
  }
}

// PBKDF2 password hashing with the Web Crypto API (available in Workers).
export async function hashPassword(password: string, saltBase64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: bytesToBase64(salt)
  };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const { hash: computed } = await hashPassword(password, salt);
  return timingSafeEqual(computed, hash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}
