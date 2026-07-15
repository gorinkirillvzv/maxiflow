// Публичный эндпоинт Mini App: отдаёт конфигурацию Mini App для рендера на /m/<bot>.
// Без авторизации — только `bot` username из query. Возвращает минимум полей,
// которые нужны рендереру: channel-контекст + JSON конфига.
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const botUsername = url.searchParams.get("bot")?.trim() ?? "";
  if (!botUsername) return Response.json({ error: "Нужен параметр bot" }, { status: 400 });

  const admin = createAdminClient();

  const { data: bot, error } = await admin
    .from("bots")
    .select("id, max_bot_username, channel_id, channel_title, channel_link, mini_app_config, mini_app_updated_at")
    .eq("max_bot_username", botUsername)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });

  return Response.json({
    bot_id: bot.id,
    username: bot.max_bot_username,
    channel_id: bot.channel_id,
    channel_title: bot.channel_title,
    channel_link: bot.channel_link,
    mini_app_config: bot.mini_app_config ?? null,
    mini_app_updated_at: bot.mini_app_updated_at,
  });
}
