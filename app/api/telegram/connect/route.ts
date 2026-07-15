// Подключение Telegram-бота. Принимает token и @username канала (или chat_id),
// валидирует через getMe + getChat + проверку что бот админ канала.
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { tgGetMe, tgGetChat, tgGetChatMember } from "@/lib/telegramApi";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: { token?: string; channel?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const token = (body.token ?? "").trim();
  const channelRef = (body.channel ?? "").trim();
  if (!token) return Response.json({ error: "Нужен токен бота" }, { status: 400 });
  if (!channelRef) return Response.json({ error: "Нужен @канал или chat_id" }, { status: 400 });

  let bot;
  try { bot = await tgGetMe(token); } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Токен невалидный" }, { status: 400 });
  }

  // нормализуем reference: @channel → -channel_id или @channel
  const ref: string | number = channelRef.startsWith("@")
    ? channelRef
    : channelRef.startsWith("-") || /^\d+$/.test(channelRef) ? Number(channelRef) : `@${channelRef}`;

  let chat;
  try { chat = await tgGetChat(token, ref); } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Канал не найден" }, { status: 400 });
  }

  // проверяем что бот в нём админ
  try {
    const me = await tgGetChatMember(token, chat.id, bot.id);
    if (me.status !== "administrator" && me.status !== "creator") {
      return Response.json({
        error: `Бот не админ в этом канале (статус: ${me.status}). Сделай его админом с правом «приглашать пользователей по ссылке».`,
      }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Проверка прав не удалась" }, { status: 400 });
  }

  const { data: tenant } = await supabase
    .from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return Response.json({ error: "Tenant не найден" }, { status: 400 });

  const { data: created, error } = await supabase
    .from("bots")
    .insert({
      tenant_id: tenant.id,
      platform: "telegram",
      bot_token: encrypt(token),
      max_bot_username: bot.username,
      max_bot_user_id: bot.id,
      channel_id: chat.id,
      channel_link: chat.invite_link ?? (chat.username ? `https://t.me/${chat.username}` : null),
      channel_title: chat.title ?? bot.first_name,
      is_active: true,
    })
    .select("id, max_bot_username, channel_title")
    .single();
  if (error) {
    if (error.code === "23505") return Response.json({ error: "Этот бот уже подключён" }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, bot: created });
}
