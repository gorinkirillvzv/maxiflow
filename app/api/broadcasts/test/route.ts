// Тестовая рассылка: отправляем ОДНО сообщение в личные диалоги админов бота
// (bot_admins.dm_chat_id). Никаких записей в broadcasts, никакого веером
// по подписчикам — только предпросмотр текста и кнопки. Rate-limit жёсткий.
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { maybeDecrypt } from "@/lib/crypto";
import { botSendMessage } from "@/lib/botSend";
import { resolveBroadcastButton } from "@/app/api/broadcasts/route";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  // 10 тестов в минуту хватит — это же предпросмотр
  const rl = rateLimit(`broadcast-test:user:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimited(rl, 10);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const bot_id = typeof body.bot_id === "string" ? body.bot_id : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!bot_id || !text) {
    return Response.json({ error: "Нужен бот и текст" }, { status: 400 });
  }

  const { data: bot } = await supabase
    .from("bots").select("bot_token, tenant_id, platform").eq("id", bot_id).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });
  const token = maybeDecrypt(bot.bot_token);
  if (!token) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });
  const platform = (bot.platform as "max" | "telegram") ?? "max";

  const buttonResolved = await resolveBroadcastButton(supabase, body.button, bot.tenant_id as string);
  const buttons = buttonResolved
    ? [{ text: buttonResolved.text, url: buttonResolved.target_url }]
    : undefined;

  const MEDIA_KINDS = new Set(["image", "video", "audio", "video_note", "file", "sticker"]);
  const media = (() => {
    const k = typeof body.media_kind === "string" ? body.media_kind : null;
    const t = typeof body.media_token === "string" ? body.media_token.trim() : "";
    return k && t && MEDIA_KINDS.has(k)
      ? { kind: k as "image" | "video" | "audio" | "video_note" | "file" | "sticker", token: t }
      : null;
  })();

  // Личные диалоги админов бота — куда шлём тестовое.
  const { data: admins } = await supabase
    .from("bot_admins")
    .select("max_user_id, dm_chat_id")
    .eq("bot_id", bot_id)
    .not("dm_chat_id", "is", null);

  const chats = (admins ?? [])
    .map((a) => a.dm_chat_id as number)
    .filter((v, i, a) => v != null && a.indexOf(v) === i);

  if (chats.length === 0) {
    return Response.json({
      error: "Не нашёл, куда прислать тест. Напишите этому боту в ЛС хотя бы одно сообщение, чтобы связать ваш аккаунт как админа (страница «Каналы» → «Привязать себя»).",
    }, { status: 400 });
  }

  let sent = 0, failed = 0;
  for (const chatId of chats) {
    try {
      const res = await botSendMessage(platform, token, chatId, text, { markdown: true, buttons, media });
      if (res.ok) sent++; else failed++;
    } catch {
      failed++;
    }
  }
  return Response.json({ ok: true, sent, failed, total: chats.length });
}
