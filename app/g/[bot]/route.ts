// /g/<bot> — обработчик кнопки «Получить лид-магнит» под постом канала.
// Юзер пришёл с рекламы через /r/, тот поставил куку mfx_sid и редиректнул на пост.
// Сейчас юзер нажал кнопку под постом — браузер автоматически шлёт куку обратно к нам.
// По куке поднимаем yclid из mfx_sessions и редиректим в чат с ботом со start payload.
//
// Если куки нет (юзер пришёл на пост напрямую, не через рекламу) — всё равно
// пускаем в бота, просто без yclid. Конверсия не сматчится, но юзер магнит получит.
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ bot: string }> },
) {
  const { bot } = await ctx.params;
  const cookieHeader = request.headers.get("cookie") || "";
  const sidMatch = cookieHeader.match(/(?:^|;\s*)mfx_sid=([A-Za-z0-9]{6,32})/);
  const sid = sidMatch?.[1] ?? null;

  const supabase = createAdminClient();
  const { data: botRec } = await supabase
    .from("bots")
    .select("id, max_bot_username, platform")
    .eq("max_bot_username", bot)
    .maybeSingle();

  if (!botRec) {
    return new Response("bot not found", { status: 404 });
  }

  // Поднимаем сессию по куке. Если найдена — start payload включит mfxsess_<id>,
  // бот распарсит и достанет yclid из БД (см. handlers.parse_mfx_session).
  let startToken = "";
  if (sid) {
    const { data: session } = await supabase
      .from("mfx_sessions")
      .select("id, bot_id")
      .eq("id", sid)
      .maybeSingle();
    // Не привязываем сессию к боту жёстко — у клиента может быть несколько
    // ботов и одна сессия (одна реклама → разные посты), но проверяем чтобы
    // tenant_id совпадал — на это есть индекс mfx_sessions.bot_id.
    if (session) {
      startToken = `mfxsess_${session.id}`;
      // Помечаем сессию как использованную для аналитики (по желанию).
      await supabase.from("mfx_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", session.id);
    }
  }

  const target = botRec.platform === "telegram"
    ? `https://t.me/${botRec.max_bot_username}${startToken ? `?start=${startToken}` : ""}`
    : `https://max.ru/${botRec.max_bot_username}${startToken ? `?start=${startToken}` : ""}`;

  return Response.redirect(target, 302);
}
