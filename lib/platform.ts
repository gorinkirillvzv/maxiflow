// Активная платформа кабинета (workspace-switcher): MAX или Telegram.
// Источник истины — cookie `mfx_platform`: она автоматически уезжает во все
// fetch-запросы к нашим API и читается в server components через next/headers.
// localStorage дублируем только для мгновенной отрисовки свитчера до гидрации.

export type Platform = "max" | "telegram" | "instagram";

export const PLATFORM_COOKIE = "mfx_platform";
const LS_KEY = "mfx.platform";

export function isPlatform(v: unknown): v is Platform {
  return v === "max" || v === "telegram" || v === "instagram";
}

/** Клиент: прочитать активную платформу (cookie → localStorage → 'max'). */
export function readPlatform(): Platform {
  if (typeof document === "undefined") return "max";
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${PLATFORM_COOKIE}=(max|telegram|instagram)`));
  if (m && isPlatform(m[1])) return m[1];
  try {
    const ls = localStorage.getItem(LS_KEY);
    if (isPlatform(ls)) return ls;
  } catch { /* noop */ }
  return "max";
}

/** Клиент: переключить платформу. Страница перезагружается, чтобы все данные
 *  (списки ботов, дашборд, истории) перечитались уже с новым фильтром. */
export function switchPlatform(p: Platform): void {
  if (typeof document === "undefined") return;
  try { localStorage.setItem(LS_KEY, p); } catch { /* noop */ }
  document.cookie = `${PLATFORM_COOKIE}=${p}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
