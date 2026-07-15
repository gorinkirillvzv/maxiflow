// Лёгкая память «активного бота» через localStorage.
// На каждой странице с селектом бота инициализируем из этого хранилища, обновляем при выборе.

const KEY = "mfx.activeBotId";

export function readActiveBotId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function writeActiveBotId(id: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, id); } catch { /* noop */ }
}

/** Выбрать стартовый bot_id из списка: preferred (localStorage) → первый. */
export function pickActiveBot<T extends { id: string }>(bots: T[]): T | null {
  if (!bots.length) return null;
  const preferred = readActiveBotId();
  if (preferred) {
    const match = bots.find((b) => b.id === preferred);
    if (match) return match;
  }
  return bots[0];
}
