// Mini App endpoint: одношаговая подписка юзера на канал через MAX BotAPI.
// POST /chats/{channel}/members — бот добавляет пользователя.
// Может вернуть { success: false } если у юзера в настройках приватности
// запрещено добавление ботами — тогда фронт делает fallback на openMaxLink(channel).
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeDecrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_API = "https://botapi.max.ru";

export async function POST(request: Request) {
  let body: { pc_id?: unknown; bot_id?: unknown; user_id?: unknown; max_user_id?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Bad request" }, { status: 400 }); }

  const pcId = typeof body.pc_id === "string" ? body.pc_id : "";
  const botIdRaw = typeof body.bot_id === "string" ? body.bot_id : "";
  // user_id и max_user_id — синонимы, поддерживаем оба (custom Mini App шлёт max_user_id)
  const userRaw = body.user_id ?? body.max_user_id;
  const userId = typeof userRaw === "number" ? userRaw
                 : typeof userRaw === "string" ? Number(userRaw) : null;
  if ((!pcId && !botIdRaw) || !userId || Number.isNaN(userId)) {
    return Response.json({ error: "Нужны pc_id или bot_id + user_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Определяем bot_id: либо напрямую (custom Mini App), либо через post_campaigns (магнит-flow).
  let botId = botIdRaw;
  if (!botId && pcId) {
    const { data: campaign } = await admin
      .from("post_campaigns").select("bot_id").eq("id", pcId).maybeSingle();
    if (!campaign) return Response.json({ error: "Кампания поста не найдена" }, { status: 404 });
    botId = campaign.bot_id as string;
  }

  const { data: bot } = await admin
    .from("bots")
    .select("bot_token, channel_id, channel_link")
    .eq("id", botId)
    .maybeSingle();
  if (!bot?.channel_id) return Response.json({ error: "У бота не привязан канал" }, { status: 400 });
  const token = maybeDecrypt(bot.bot_token);
  if (!token) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });

  // Пытаемся добавить юзера в канал.
  // На стороне MAX может прилететь:
  //   { success: true }                              — всё ок
  //   { success: false, failed_user_ids: [...], failed_user_details: [...] }
  //     обычно error_code = "add.participant.privacy" (юзер запретил)
  let added = false;
  let errorCode: string | null = null;
  try {
    const r = await fetch(`${MAX_API}/chats/${bot.channel_id}/members`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: [userId] }),
      cache: "no-store",
    });
    const txt = await r.text();
    let parsed: { success?: boolean; failed_user_details?: { error_code?: string }[] } = {};
    try { parsed = JSON.parse(txt); } catch { /* ignore */ }
    if (r.ok && parsed.success === true) {
      added = true;
    } else {
      errorCode = parsed.failed_user_details?.[0]?.error_code || `http_${r.status}`;
    }
    console.log("mini/subscribe attempt", { user_id: userId, channel_id: bot.channel_id, status: r.status, added, errorCode });
  } catch (e) {
    errorCode = e instanceof Error ? e.message : String(e);
  }

  // Если не добавили — фронт откроет канал в MAX, юзер подпишется сам, и authoRefresh переключит на магнит.
  return Response.json({
    added,
    error_code: errorCode,
    channel_link: bot.channel_link || null,
  });
}
