// Token-bucket-ish rate limiter backed by Cloudflare KV.
// We don't need exact accuracy — KV's eventual consistency is fine for blocking abuse.
//
// Each key stores `{ count, resetAt }`. When `now >= resetAt`, the window resets.

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number; // seconds until the window resets
};

type Bucket = { count: number; resetAt: number };

export async function rateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const raw = await kv.get(key);
  let bucket: Bucket;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Bucket;
      bucket = parsed.resetAt > now ? parsed : { count: 0, resetAt: now + windowSeconds };
    } catch {
      bucket = { count: 0, resetAt: now + windowSeconds };
    }
  } else {
    bucket = { count: 0, resetAt: now + windowSeconds };
  }

  bucket.count += 1;
  const ttl = Math.max(60, bucket.resetAt - now); // KV requires >=60s

  await kv.put(key, JSON.stringify(bucket), { expirationTtl: ttl });

  const retryAfter = Math.max(0, bucket.resetAt - now);
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter };
}

export function clientIp(headers: Headers): string {
  // Cloudflare always sets CF-Connecting-IP. Fallbacks for local/dev only.
  return (
    headers.get('CF-Connecting-IP') ||
    headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
