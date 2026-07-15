// Server-side хелперы для Telegram Bot API.
const BASE = "https://api.telegram.org";

export type TelegramBot = {
  id: number;
  username: string;
  first_name: string;
};

export type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
  invite_link?: string;
};

async function call<T>(token: string, method: string, params?: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: params ? JSON.stringify(params) : undefined,
    cache: "no-store",
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram API: ${j.description ?? r.status}`);
  return j.result as T;
}

export async function tgGetMe(token: string): Promise<TelegramBot> {
  return call<TelegramBot>(token, "getMe");
}

/** Получить чат по @username или числовому id. Бот должен быть в нём админом. */
export async function tgGetChat(token: string, chatRef: string | number): Promise<TelegramChat> {
  return call<TelegramChat>(token, "getChat", { chat_id: chatRef });
}

/** Проверка что бот — админ в чате. Возвращает status строкой. */
export async function tgGetChatMember(token: string, chatId: number | string, userId: number): Promise<{ status: string }> {
  return call<{ status: string }>(token, "getChatMember", { chat_id: chatId, user_id: userId });
}
