// Универсальная отправка сообщения от бота: выбирает MAX или Telegram по platform.
import { maxSendMessage, type MaxMedia } from "./maxApi";

export type SendButton = { text: string; url: string };
export type SendMedia = MaxMedia;   // { kind, token }

export async function botSendMessage(
  platform: "max" | "telegram",
  token: string,
  chatId: number,
  text: string,
  opts: { markdown?: boolean; buttons?: SendButton[]; media?: SendMedia | null } = {},
): Promise<{ ok: boolean; status: number }> {
  const { markdown, buttons, media } = opts;
  if (platform === "telegram") {
    // Для TG media-токены из MAX не подходят. Пока рассылки TG-ботов идут только текстом.
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (markdown) body.parse_mode = "Markdown";
    if (buttons && buttons.length) {
      body.reply_markup = {
        inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url }))],
      };
    }
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return { ok: r.ok, status: r.status };
  }
  const maxButtons = buttons && buttons.length
    ? [buttons.map((b) => ({ type: "link" as const, text: b.text, url: b.url }))]
    : undefined;
  const res = await maxSendMessage(
    token, chatId, text,
    maxButtons,
    markdown ? "markdown" : undefined,
    media ?? null,
  );
  return { ok: res.ok, status: res.status };
}
