// Публикация поста в канал MAX: сразу или отложенно (scheduled_posts).
import { maxSendMessage, botStartUrl, safeButtonUrl, type MaxMediaKind } from "@/lib/maxApi";
import { createClient } from "@/lib/supabase/server";
import { maybeDecrypt } from "@/lib/crypto";

const MEDIA_KINDS: MaxMediaKind[] = ["image", "video", "audio", "video_note", "file", "sticker"];

function newCampaignId(): string {
  // 12 hex символов — короткий и помещается в start payload
  const a = Math.random().toString(16).slice(2, 8).padEnd(6, "0");
  const b = (Date.now() & 0xffffff).toString(16).padStart(6, "0");
  return `${a}${b}`;
}

function pickSubscribeMessage(body: Record<string, unknown>): string | null {
  const v = body.subscribe_message;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2000) return trimmed.slice(0, 2000);
  return trimmed;
}

function pickMedia(body: Record<string, unknown>): { kind: MaxMediaKind; token: string } | null {
  const kind = body.media_kind;
  const token = body.media_token;
  if (typeof kind !== "string" || typeof token !== "string" || !token.trim()) return null;
  if (!MEDIA_KINDS.includes(kind as MaxMediaKind)) return null;
  return { kind: kind as MaxMediaKind, token: token.trim() };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const { bot_id, text, button_text, scheduled_at } = body;
  // пустая строка из формы не пройдёт как uuid — считаем её отсутствием привязки
  const funnelId = typeof body.funnel_id === "string" && body.funnel_id.trim()
    ? body.funnel_id.trim()
    : null;
  if (!bot_id || !text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Нужен бот и текст поста" }, { status: 400 });
  }
  if (text.length > 4000) {
    return Response.json({ error: "Текст длиннее 4000 символов" }, { status: 400 });
  }

  // бот арендатора (RLS ограничит чужими)
  const { data: bot } = await supabase
    .from("bots")
    .select("tenant_id, bot_token, max_bot_username, channel_id")
    .eq("id", bot_id)
    .single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });
  if (!bot.channel_id) {
    return Response.json({ error: "У бота не привязан канал" }, { status: 400 });
  }

  const btn = typeof button_text === "string" && button_text.trim() ? button_text.trim() : null;
  const customUrl = safeButtonUrl(body.button_url);
  const media = pickMedia(body);
  const subscribeMsg = pickSubscribeMessage(body);
  // Явный выбор: true=мини-апп, false=прямая ссылка в бота. Fallback — старая логика.
  const useMiniapp = typeof body.use_miniapp === "boolean" ? body.use_miniapp : !!subscribeMsg;

  // воронка, которую запустит кнопка лид-магнита
  let funnelTrigger: string | null = null;
  if (funnelId) {
    const { data: f } = await supabase
      .from("funnels").select("trigger_command")
      .eq("id", funnelId).eq("bot_id", bot_id).maybeSingle();
    funnelTrigger = f?.trigger_command ?? null;
  }

  // --- отложенная публикация ---
  if (scheduled_at) {
    const when = new Date(scheduled_at as string);
    if (isNaN(when.getTime())) {
      return Response.json({ error: "Некорректная дата публикации" }, { status: 400 });
    }
    if (when.getTime() < Date.now() + 30_000) {
      return Response.json({ error: "Время публикации должно быть в будущем" }, { status: 400 });
    }
    const { error: insErr } = await supabase.from("scheduled_posts").insert({
      tenant_id: bot.tenant_id,
      bot_id,
      text: text.trim(),
      button_text: btn,
      format: "markdown",
      scheduled_at: when.toISOString(),
      funnel_id: customUrl ? null : funnelId,
      button_url: customUrl,
      media_kind: media?.kind ?? null,
      media_token: media?.token ?? null,
      subscribe_message: subscribeMsg,
      disable_link_preview: body.disable_link_preview === true ? true : null,
    });
    if (insErr) {
      return Response.json({ error: "Не удалось запланировать пост" }, { status: 500 });
    }
    return Response.json({ ok: true, scheduled: true });
  }

  // --- публикация сразу ---
  // Если задан subscribe_message → создаём post_campaign и в кнопке deeplink на pc_<id>.
  // Если нет, и нет custom URL — fallback на старый deeplink с triggerom воронки.
  let campaignId: string | null = null;
  if (btn && !customUrl && useMiniapp && subscribeMsg) {
    campaignId = newCampaignId();
    const { error: campErr } = await supabase.from("post_campaigns").insert({
      id: campaignId,
      tenant_id: bot.tenant_id,
      bot_id,
      subscribe_message: subscribeMsg,
      funnel_id: funnelId,
    });
    if (campErr) {
      return Response.json({ error: `campaign insert: ${campErr.message}` }, { status: 500 });
    }
  }

  // Кнопка:
  //  - custom URL → link
  //  - есть subscribe_message + campaignId → link на MAX startapp deeplink
  //    (если Mini App зарегистрирован у бота → откроется приложение;
  //     иначе откроется чат с ботом с payload pc_<id>)
  //  - иначе → link на обычный bot deeplink
  // Универсальный Mini App: deeplink через бот Maxiflow (NEXT_PUBLIC_MAXIFLOW_BOT_USERNAME).
  // Если ENV не задана — fallback на бот тенанта (старое поведение).
  const universalBot = process.env.NEXT_PUBLIC_MAXIFLOW_BOT_USERNAME || bot.max_bot_username;
  const buttons = btn
    ? customUrl
      ? [[{ type: "link" as const, text: btn, url: customUrl }]]
      : campaignId
        ? [[{ type: "link" as const, text: btn, url: `https://max.ru/${universalBot}?startapp=pc_${campaignId}` }]]
        : [[{ type: "link" as const, text: btn, url: botStartUrl(bot.max_bot_username, funnelTrigger) }]]
    : undefined;

  const botToken = maybeDecrypt(bot.bot_token);
  if (!botToken) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });
  const disableLinkPreview = body.disable_link_preview === true;
  const res = await maxSendMessage(botToken, bot.channel_id, text.trim(), buttons, "markdown", media,
    disableLinkPreview ? { disableLinkPreview: true } : undefined);
  if (!res.ok) {
    return Response.json(
      { error: `MAX отклонил публикацию (${res.status})` },
      { status: 502 },
    );
  }

  // достаём mid опубликованного поста и архивируем оригинальный markdown
  const respBody = (res.body as Record<string, unknown> | null) ?? null;
  const message = (respBody?.message ?? {}) as Record<string, unknown>;
  const bodyObj = (message.body ?? {}) as Record<string, unknown>;
  const mid = typeof bodyObj.mid === "string" ? bodyObj.mid : null;

  if (mid && campaignId) {
    await supabase.from("post_campaigns").update({ post_mid: mid }).eq("id", campaignId);
  }
  if (mid) {
    // upsert post_archives — храним оригинальный текст с markdown, чтобы при
    // следующем редактировании не потерять форматирование (MAX возвращает plain text).
    await supabase.from("post_archives").upsert({
      bot_id: bot_id as string,
      tenant_id: bot.tenant_id,
      post_mid: mid,
      raw_text: text.trim(),
      raw_button_text: btn,
      disable_link_preview: disableLinkPreview ? true : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "bot_id,post_mid" });
  }

  return Response.json({ ok: true });
}
