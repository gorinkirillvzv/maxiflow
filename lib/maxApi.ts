// Серверный хелпер для MAX Bot API (https://botapi.max.ru).
// Авторизация — заголовок Authorization: <token> (без Bearer).
const BASE = "https://botapi.max.ru";

/** Deeplink запуска бота: ?start=<команда> либо чистая ссылка (воронка по умолчанию). */
export function botStartUrl(username: string, command?: string | null): string {
  const root = `https://max.ru/${username}`;
  const cmd = (command ?? "").trim();
  return cmd ? `${root}?start=${encodeURIComponent(cmd)}` : root;
}

export type MaxBot = {
  user_id: number;
  username: string;
  name: string;
};

export type MaxChannel = {
  chat_id: number;
  type: string;
  title: string;
  link: string | null;
  participants_count: number | null;
};

export async function maxGetMe(token: string): Promise<MaxBot> {
  const r = await fetch(`${BASE}/me`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`max_me_${r.status}`);
  const d = await r.json();
  return { user_id: d.user_id, username: d.username, name: d.name ?? d.first_name };
}

type InlineButton =
  | { type: "link"; text: string; url: string }
  | { type: "callback"; text: string; payload: string }
  | { type: "open_app"; text: string; url: string };  // MAX Mini App запуск

export type MaxTextFormat = "markdown" | "html";

/** Безопасный URL для кнопки поста: только http(s) и до 2000 символов. */
export function safeButtonUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 2000) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}
export type MaxMediaKind = "image" | "video" | "audio" | "video_note" | "file" | "sticker";
export type MaxMedia = { kind: MaxMediaKind; token: string };

function buildAttachments(buttons?: InlineButton[][], media?: MaxMedia | null) {
  const attachments: Record<string, unknown>[] = [];
  if (media?.token) {
    attachments.push({ type: media.kind, payload: { token: media.token } });
  }
  if (buttons && buttons.length) {
    attachments.push({ type: "inline_keyboard", payload: { buttons } });
  }
  return attachments;
}

export async function maxSendMessage(
  token: string,
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
  format?: MaxTextFormat,
  media?: MaxMedia | null,
  options?: { disableLinkPreview?: boolean },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const body: Record<string, unknown> = { text };
  if (format) body.format = format;
  const attachments = buildAttachments(buttons, media);
  if (attachments.length) body.attachments = attachments;
  // MAX параметр для отключения превью ссылок (web_page attachment).
  // Если ссылка в тексте, MAX автоматически добавляет attachment с превью —
  // disable_link_preview=true просит это не делать.
  if (options?.disableLinkPreview) body.disable_link_preview = true;
  const r = await fetch(`${BASE}/messages?chat_id=${chatId}`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let parsed: unknown = null;
  try {
    parsed = await r.json();
  } catch {
    /* ignore */
  }
  return { ok: r.ok, status: r.status, body: parsed };
}

export type MaxPost = {
  mid: string;
  text: string;
  views: number | null;
  url: string | null;
  timestamp: number | null;
  hasButton: boolean;
  buttonText: string | null;
  buttonUrl: string | null;
  mediaKind: MaxMediaKind | null;
  mediaThumb: string | null;
};

export async function maxListMessages(token: string, chatId: number): Promise<MaxPost[]> {
  const r = await fetch(`${BASE}/messages?chat_id=${chatId}&count=30`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`max_messages_${r.status}`);
  const d = await r.json();
  const MEDIA_TYPES: MaxMediaKind[] = ["image", "video", "audio", "video_note", "file", "sticker"];
  return (d.messages ?? []).map((m: Record<string, unknown>) => {
    const body = (m.body ?? {}) as Record<string, unknown>;
    const attachments = (body.attachments ?? []) as Record<string, unknown>[];
    // у поста может быть максимум одно медиа (рядом с inline_keyboard)
    const mediaAtt = attachments.find((a) => MEDIA_TYPES.includes(a.type as MaxMediaKind));
    let thumb: string | null = null;
    if (mediaAtt) {
      const payload = (mediaAtt.payload ?? {}) as Record<string, unknown>;
      const url = payload.url ?? payload.preview ?? payload.thumbnail ?? payload.photo_url;
      if (typeof url === "string") thumb = url;
    }
    // вытаскиваем текст и URL первой кнопки inline_keyboard для редактора
    let buttonText: string | null = null;
    let buttonUrl: string | null = null;
    const kbAtt = attachments.find((a) => a.type === "inline_keyboard");
    if (kbAtt) {
      const payload = (kbAtt.payload ?? {}) as Record<string, unknown>;
      const rows = (payload.buttons ?? []) as Record<string, unknown>[][];
      const first = rows?.[0]?.[0];
      if (first) {
        buttonText = typeof first.text === "string" ? first.text : null;
        buttonUrl = typeof first.url === "string" ? first.url : null;
      }
    }
    return {
      mid: body.mid,
      text: (body.text as string) ?? "",
      views: ((m.stat ?? {}) as { views?: number }).views ?? null,
      url: (m.url as string) ?? null,
      timestamp: (m.timestamp as number) ?? null,
      hasButton: !!kbAtt,
      buttonText,
      buttonUrl,
      mediaKind: (mediaAtt?.type as MaxMediaKind) ?? null,
      mediaThumb: thumb,
    };
  });
}

export async function maxEditMessage(
  token: string,
  messageId: string,
  text: string,
  buttons?: InlineButton[][],
  format?: MaxTextFormat,
  media?: MaxMedia | null,
  options?: { disableLinkPreview?: boolean },
): Promise<{ ok: boolean; status: number }> {
  const body: Record<string, unknown> = { text };
  if (format) body.format = format;
  const attachments = buildAttachments(buttons, media);
  if (attachments.length) body.attachments = attachments;
  if (options?.disableLinkPreview) body.disable_link_preview = true;
  const r = await fetch(`${BASE}/messages?message_id=${messageId}`, {
    method: "PUT",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: r.ok, status: r.status };
}

/** Проверяет, является ли бот админом в канале.
 *  Признак: GET /chats/{id}/members отдаёт 200 админу и 403 chat.denied всем остальным. */
export async function maxIsChannelAdmin(token: string, chatId: number | string): Promise<boolean> {
  const r = await fetch(`${BASE}/chats/${chatId}/members?count=1`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  return r.ok;
}

export async function maxListChannels(token: string): Promise<MaxChannel[]> {
  const r = await fetch(`${BASE}/chats?count=100`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`max_chats_${r.status}`);
  const d = await r.json();
  return (d.chats ?? [])
    .filter((c: { type?: string }) => c.type === "channel")
    .map((c: Record<string, unknown>) => ({
      chat_id: c.chat_id,
      type: c.type,
      title: c.title,
      link: c.link ?? null,
      participants_count: c.participants_count ?? null,
    }));
}
