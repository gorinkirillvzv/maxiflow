// Mini App endpoint: проверка подписки на канал + выдача состояния магнита.
// Вызывается из /m/<bot>/<pc>/page.tsx после подгрузки MAX Bridge SDK.
//
// MVP без HMAC-валидации initData — доверяем user_id из initDataUnsafe.
// TODO: добавить HMAC-валидацию (https://dev.max.ru/docs/webapps/validation).
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeDecrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_API = "https://botapi.max.ru";

async function isChatMember(token: string, chatId: number, userId: number): Promise<{ ok: boolean; raw: unknown; status: number }> {
  const r = await fetch(`${MAX_API}/chats/${chatId}/members?user_ids=${userId}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  const txt = await r.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt.slice(0, 300) }; }
  if (!r.ok) return { ok: false, raw: parsed, status: r.status };
  const d = parsed as { members?: unknown[] };
  const isMember = Array.isArray(d.members) && d.members.length > 0;
  return { ok: isMember, raw: parsed, status: r.status };
}

export async function POST(request: Request) {
  let body: { bot_username?: unknown; pc_id?: unknown; user_id?: unknown; init_data?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Bad request" }, { status: 400 }); }

  const botUsername = typeof body.bot_username === "string" ? body.bot_username : "";
  const pcId = typeof body.pc_id === "string" ? body.pc_id : "";
  const userId = typeof body.user_id === "number" ? body.user_id
                 : typeof body.user_id === "string" ? Number(body.user_id) : null;

  if (!botUsername || !pcId) {
    return Response.json({ error: "Не указаны bot_username и pc_id" }, { status: 400 });
  }
  if (!userId || Number.isNaN(userId)) {
    return Response.json({ error: "Mini App запущен вне MAX (user_id не получен)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Сначала ищем кампанию по pc_id — она знает к какому именно боту (тенанта) принадлежит.
  // Это ВАЖНО для универсального Mini App от Maxiflow-бота:
  // URL Mini App ведёт на наш Maxiflow-бот, но pc_id принадлежит ботy тенанта,
  // и проверять подписку нужно ИМЕННО У ТЕНАНТА (его канал, его токен).
  const { data: campaign } = await admin
    .from("post_campaigns")
    .select("id, bot_id, subscribe_message, funnel_id")
    .eq("id", pcId)
    .maybeSingle();
  if (!campaign) return Response.json({ error: "Кампания поста не найдена" }, { status: 404 });

  const { data: bot } = await admin
    .from("bots")
    .select("id, tenant_id, bot_token, channel_id, channel_link, channel_title, max_bot_username")
    .eq("id", campaign.bot_id)
    .maybeSingle();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });
  if (!bot.channel_id) {
    return Response.json({ error: "У бота не привязан канал" }, { status: 400 });
  }
  void botUsername;

  // Магнит активного бота — отдадим клиенту чтобы Mini App могла показать выдачу прямо здесь.
  const { data: magnet } = await admin
    .from("magnets")
    .select("title, description, delivery_text, preview_items, file_url, file_name, subscribe_button_text, check_button_text, not_subscribed_text")
    .eq("bot_id", bot.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const token = maybeDecrypt(bot.bot_token);
  if (!token) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });

  // Проверка подписки на канал
  let subscribed = false;
  let membershipRaw: unknown = null;
  let membershipStatus: number | null = null;
  try {
    const res = await isChatMember(token, bot.channel_id, userId);
    subscribed = res.ok;
    membershipRaw = res.raw;
    membershipStatus = res.status;
  } catch (e) {
    membershipRaw = { exception: e instanceof Error ? e.message : String(e) };
  }
  console.log("mini/check membership", {
    bot: bot.max_bot_username,
    user_id: userId,
    channel_id: bot.channel_id,
    pc_id: pcId,
    status: membershipStatus,
    subscribed,
    raw: membershipRaw,
  });

  if (!subscribed) {
    return Response.json({
      subscribed: false,
      subscribe_message: campaign.subscribe_message
        || magnet?.not_subscribed_text
        || "Подпишись на канал, чтобы получить материал.",
      channel_link: bot.channel_link || null,
      channel_title: bot.channel_title || null,
      subscribe_button_text: magnet?.subscribe_button_text || "Подписаться на канал",
      check_button_text: magnet?.check_button_text || "Я подписался",
    });
  }

  // Подписан — пытаемся восстановить yclid рекламного клика для атрибуции конверсии.
  // 1. По куке mfx_sid (работает если MAX-WebView шарит куки с in-app браузером)
  // 2. По IP-fallback: ищем mfx_sessions с тем же IP в последние 30 минут
  let attribution: { yclid: string | null; direct_campaign_id: string | null; vk_click_id: string | null } = {
    yclid: null, direct_campaign_id: null, vk_click_id: null,
  };

  // (1) cookie path
  const cookieHeader = request.headers.get("cookie") || "";
  const sidMatch = cookieHeader.match(/(?:^|;\s*)mfx_sid=([A-Za-z0-9]{6,32})/);
  if (sidMatch) {
    const { data: sess } = await admin
      .from("mfx_sessions")
      .select("yclid, direct_campaign_id, vk_click_id")
      .eq("id", sidMatch[1])
      .maybeSingle();
    if (sess) attribution = sess;
  }

  // (2) IP fallback — только если по куке не нашли yclid
  if (!attribution.yclid) {
    const xff = request.headers.get("x-forwarded-for") || "";
    const clientIp = xff.split(",")[0]?.trim() || null;
    if (clientIp) {
      const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data: ipSess } = await admin
        .from("mfx_sessions")
        .select("yclid, direct_campaign_id, vk_click_id, created_at")
        .eq("client_ip", clientIp)
        .gte("created_at", cutoff)
        .not("yclid", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (ipSess && ipSess[0]) {
        attribution = {
          yclid: ipSess[0].yclid,
          direct_campaign_id: ipSess[0].direct_campaign_id,
          vk_click_id: ipSess[0].vk_click_id,
        };
        console.log("mini/check IP-match", { user_id: userId, ip: clientIp, yclid: attribution.yclid });
      }
    }
  }

  // Upsert лида: подписка подтверждена прямо в Mini App, помечаем subscribed_at.
  // magnet_sent_at НЕ ставим здесь — магнит выдаст бот в чате, и он же пометит.
  // conv_worker подхватит channel_subscribed на следующем тике.
  const nowIso = new Date().toISOString();
  try {
    const { data: existing } = await admin
      .from("leads")
      .select("id, yclid, direct_campaign_id, vk_click_id, subscribed_at")
      .eq("bot_id", bot.id)
      .eq("max_user_id", userId)
      .maybeSingle();
    if (existing) {
      const upd: Record<string, string | null> = {};
      if (!existing.yclid && attribution.yclid) upd.yclid = attribution.yclid;
      if (!existing.direct_campaign_id && attribution.direct_campaign_id) upd.direct_campaign_id = attribution.direct_campaign_id;
      if (!existing.vk_click_id && attribution.vk_click_id) upd.vk_click_id = attribution.vk_click_id;
      if (!existing.subscribed_at) upd.subscribed_at = nowIso;
      if (Object.keys(upd).length) await admin.from("leads").update(upd).eq("id", existing.id);
    } else {
      await admin.from("leads").insert({
        tenant_id: bot.tenant_id,
        bot_id: bot.id,
        max_user_id: userId,
        max_chat_id: userId,
        first_name: "",
        yclid: attribution.yclid,
        direct_campaign_id: attribution.direct_campaign_id,
        vk_click_id: attribution.vk_click_id,
        post_campaign_id: campaign.id,
        subscribed_at: nowIso,
      });
    }
  } catch (e) {
    console.error("mini/check lead upsert failed", e);
  }

  return Response.json({
    subscribed: true,
    bot_username: bot.max_bot_username,
    attributed_yclid: attribution.yclid,
    magnet: magnet ? {
      title: magnet.title || "",
      description: magnet.description || "",
      delivery_text: magnet.delivery_text || "",
      preview_items: magnet.preview_items || "",
      file_url: magnet.file_url || null,
      file_name: magnet.file_name || null,
    } : null,
  });
}
