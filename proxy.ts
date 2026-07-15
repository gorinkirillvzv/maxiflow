// Next.js 16: Proxy (бывший middleware) — обновляет сессию Supabase
// и закрывает кабинет от неавторизованных.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, rateHeaders, clientIp } from "@/lib/rate-limit";

const PUBLIC_PREFIXES = ["/login", "/register", "/auth", "/r/", "/l/", "/g/", "/m/", "/bc/", "/confirm/", "/lp/", "/api/mini/", "/help", "/sitemap.xml", "/robots.txt"];

// IP-лимиты для разных путей (запросов / окно мс).
// Срабатывают ДО auth — защищают от перебора и абуза публичных эндпоинтов.
// methods: undefined = любой; ["POST",...] = только для этих. GET-страницы обычно не лимитим —
// Next.js делает RSC-prefetch при hover, и лимит выбирается за секунды.
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const IP_LIMITS: { match: (p: string) => boolean; limit: number; windowMs: number; bucket: string; methods?: Method[] }[] = [
  // публичный редирект и лендинги — обычный человеческий клик не бьёт больше 60/мин
  { match: (p) => p.startsWith("/r/") || p.startsWith("/l/"), limit: 60, windowMs: 60_000, bucket: "public" },
  // инкремент кликов лендинга — потенциальная мишень для накрутки
  { match: (p) => p === "/api/landings/click", limit: 30, windowMs: 60_000, bucket: "click" },
  // защита от подбора: только на write — сам сабмит формы логина/регистрации
  { match: (p) => p === "/login" || p === "/register", limit: 20, windowMs: 60_000, bucket: "auth", methods: ["POST", "PUT", "PATCH", "DELETE"] },
  // общий лимит на API
  { match: (p) => p.startsWith("/api/"), limit: 120, windowMs: 60_000, bucket: "api" },
];

// Эти эндпоинты МОГУТ принимать write-методы без same-origin (внешние вебхуки):
// — T-Bank пушит уведомления о платежах
// — systemd-таймер дёргает cron-маршруты (по секрету в заголовке)
// — Яндекс возвращается с OAuth-кодом (GET, без CSRF-риска)
const ORIGIN_BYPASS = (path: string): boolean =>
  path === "/api/billing/webhook" ||
  path.startsWith("/api/cron/") ||
  path.startsWith("/api/oauth/") ||
  path === "/api/landings/click" ||
  path === "/api/confirm";

// Базовые security-заголовки на любой ответ.
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  // X-Frame-Options не указываем — он бы переопределил CSP frame-ancestors на DENY.
  // Защита от clickjacking теперь через `frame-ancestors` (поддерживает whitelist для MAX).
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  // CSP — Next.js нужны inline-скрипты (стримминг JSX), Метрика-снипет с mc.yandex.ru,
  // Supabase Realtime через WSS. Жёстче без перехода на nonce-стратегию не выйдет.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru https://yastatic.net https://st.max.ru",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: https://mc.yandex.ru",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api-metrika.yandex.ru https://api.direct.yandex.com https://botapi.max.ru https://mc.yandex.ru https://securepay.tinkoff.ru https://*.sentry.io",
    "frame-src 'self' https://oauth.yandex.ru",
    "form-action 'self' https://oauth.yandex.ru https://accounts.yandex.ru",
    // Mini App грузится во iframe MAX Web/Desktop клиента — нужно разрешить их origin.
    // Mobile-MAX использует native WebView без CSP, ему этот заголовок безразличен.
    "frame-ancestors 'self' https://web.max.ru https://max.ru https://*.max.ru",
    "object-src 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
};

function applyHeaders(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  // 1. Rate-limit по IP — до тяжёлой работы с Supabase-сессией
  const rule = IP_LIMITS.find((r) => r.match(path) && (!r.methods || r.methods.includes(method as Method)));
  if (rule) {
    const ip = clientIp(request);
    const key = `${rule.bucket}:${ip}`;
    const rl = rateLimit(key, rule.limit, rule.windowMs);
    if (!rl.ok) {
      return applyHeaders(new NextResponse(
        JSON.stringify({ error: "Слишком много запросов. Попробуй чуть позже." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...rateHeaders(rl, rule.limit),
          },
        },
      ));
    }
  }

  // 2. Origin/Referer check для write-методов /api/* (CSRF-защита)
  if (path.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(method) && !ORIGIN_BYPASS(path)) {
    const origin = request.headers.get("origin") || "";
    const referer = request.headers.get("referer") || "";
    const host = request.headers.get("host") || "";
    const allowed = `https://${host}`;
    const httpAllowed = `http://${host}`;
    const okOrigin = origin === allowed || origin === httpAllowed;
    const okReferer = referer.startsWith(allowed + "/") || referer.startsWith(httpAllowed + "/");
    if (!okOrigin && !okReferer) {
      return applyHeaders(new NextResponse(
        JSON.stringify({ error: "forbidden: cross-origin write blocked" }),
        { status: 403, headers: { "Content-Type": "application/json; charset=utf-8" } },
      ));
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() обязателен — он обновляет токен сессии
  const { data: { user } } = await supabase.auth.getUser();

  // корень "/" — публичный маркетинговый лендинг
  const isPublic = path === "/" || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  // /api — роуты сами проверяют авторизацию (или секрет-заголовок), редирект не нужен
  const isApi = path.startsWith("/api");

  // неавторизованного — на /login
  if (!user && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applyHeaders(NextResponse.redirect(url));
  }
  // авторизованного с /login или /register — в кабинет
  if (user && (path.startsWith("/login") || path.startsWith("/register"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return applyHeaders(NextResponse.redirect(url));
  }

  return applyHeaders(response);
}

export const config = {
  // не трогаем статику и ассеты
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
