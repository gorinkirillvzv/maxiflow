// Простой in-memory rate-limiter (sliding window).
// Достаточно для одной ноды кабинета. Когда поднимем вторую — заменим на Redis.
// Ключ обычно `<route>:<ip>` или `<route>:user:<user_id>`.

type Bucket = { hits: number; resetAt: number };
const store = new Map<string, Bucket>();

// чистим протухшие бакеты раз в минуту, чтобы Map не пух
let cleanupStarted = false;
function ensureCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
  }, 60_000);
  // не блокируем shutdown в dev
  (t as unknown as { unref?: () => void }).unref?.();
}

export type RateResult = { ok: boolean; remaining: number; resetAt: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  ensureCleanup();
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { hits: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  b.hits++;
  return {
    ok: b.hits <= limit,
    remaining: Math.max(0, limit - b.hits),
    resetAt: b.resetAt,
  };
}

/** Заголовки ответа при срабатывании лимита. */
export function rateHeaders(r: RateResult, limit: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.floor(r.resetAt / 1000)),
    ...(r.ok ? {} : { "Retry-After": String(Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))) }),
  };
}

/** IP клиента из заголовков (nginx ставит x-forwarded-for). */
export function clientIp(request: Request): string {
  const h = request.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || "unknown";
}

/** JSON-ответ 429 с понятным сообщением. */
export function rateLimited(r: RateResult, limit: number): Response {
  return new Response(
    JSON.stringify({ error: "Слишком много запросов. Попробуй чуть позже." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...rateHeaders(r, limit),
      },
    },
  );
}
