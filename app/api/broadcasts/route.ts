// Рассылки: список (GET) и запуск рассылки по подписчикам бота (POST).
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { maybeDecrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { botSendMessage, type SendButton } from "@/lib/botSend";
import { safeButtonUrl, botStartUrl } from "@/lib/maxApi";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://maxiflow.ru";

export type ResolvedBroadcastButton = {
  text: string;
  target_url: string;          // финальный URL для клика (max.ru/... или произвольный)
  meta: Record<string, unknown>; // для сохранения в broadcasts.button
};

/** Разбираем кнопку. Возвращаем инфо для сохранения и финальный URL (без обёртки в /bc/click). */
export async function resolveBroadcastButton(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raw: unknown,
  tenantId: string,
): Promise<ResolvedBroadcastButton | null> {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!text || text.length > 64) return null;
  const kind = b.kind === "bot" ? "bot" : "url";
  if (kind === "url") {
    const url = safeButtonUrl(b.url);
    if (!url) return null;
    return { text, target_url: url, meta: { kind: "url", text, url } };
  }
  const targetBotId = typeof b.bot_id === "string" ? b.bot_id : "";
  if (!targetBotId) return null;
  const { data: target } = await supabase
    .from("bots").select("max_bot_username, tenant_id").eq("id", targetBotId).single();
  if (!target || target.tenant_id !== tenantId) return null;
  const trigger = typeof b.start_command === "string" ? b.start_command.trim() : "";
  const url = botStartUrl(target.max_bot_username, trigger || null);
  return {
    text,
    target_url: url,
    meta: { kind: "bot", text, bot_id: targetBotId, start_command: trigger || null, target_url: url },
  };
}

/** Оборачиваем URL кнопки в наш редирект, чтобы считать клики. */
export function wrapClickTracking(broadcastId: string, targetUrl: string): SendButton[] {
  return [{
    text: "__wrap__",
    url: `${APP_URL}/bc/${broadcastId}/click?to=${encodeURIComponent(targetUrl)}`,
  }];
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data } = await supabase
    .from("broadcasts")
    .select("id, text, total, sent, failed, clicks, button, status, created_at, bots(channel_title)")
    .order("created_at", { ascending: false })
    .limit(50);
  return Response.json({ broadcasts: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  // не больше 3 рассылок в минуту на пользователя — защита от случайного двойного клика и абуза
  const rl = rateLimit(`broadcast:user:${user.id}`, 3, 60_000);
  if (!rl.ok) return rateLimited(rl, 3);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const { bot_id, text } = body;
  const tagId = typeof body.tag_id === "string" ? body.tag_id : null;
  if (!bot_id || !text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Нужен бот и текст рассылки" }, { status: 400 });
  }

  const { data: bot } = await supabase
    .from("bots").select("bot_token, tenant_id, platform").eq("id", bot_id).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });
  const botToken: string | null = maybeDecrypt(bot.bot_token);
  if (!botToken) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });
  const platform = (bot.platform as "max" | "telegram") ?? "max";
  const tenantId = bot.tenant_id as string;

  const buttonResolved = await resolveBroadcastButton(supabase, body.button, bot.tenant_id as string);

  // Медиа-вложение: {kind: 'image'|'video'|..., token: '...'}. Оба поля обязательны.
  const MEDIA_KINDS = new Set(["image", "video", "audio", "video_note", "file", "sticker"]);
  const media = (() => {
    const k = typeof body.media_kind === "string" ? body.media_kind : null;
    const t = typeof body.media_token === "string" ? body.media_token.trim() : "";
    return k && t && MEDIA_KINDS.has(k)
      ? { kind: k as "image" | "video" | "audio" | "video_note" | "file" | "sticker", token: t }
      : null;
  })();

  // аудитория: либо все лиды бота, либо только с указанным тегом
  let taggedIds: string[] | null = null;
  if (tagId) {
    const { data: lt } = await supabase
      .from("lead_tags").select("lead_id").eq("tag_id", tagId);
    taggedIds = (lt ?? []).map((x) => x.lead_id as string);
    if (taggedIds.length === 0) {
      return Response.json({ ok: true, total: 0, sent: 0, failed: 0 });
    }
  }

  // Аудитория: только те, у кого открыт DM с ботом (есть запись в dialog_messages).
  // Просто подписчики канала MAX Bot API не пустит (403 chat.denied / 404 dialog.not.found).
  // Supabase JS отдаёт максимум 1000 строк на select — берём страницами до конца,
  // иначе теряем часть уникальных max_user_id.
  const activeUserSet = new Set<number>();
  {
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      const { data } = await supabase
        .from("dialog_messages")
        .select("max_user_id")
        .eq("bot_id", bot_id)
        .range(from, from + PAGE - 1);
      const rows = data ?? [];
      for (const r of rows) {
        const v = r.max_user_id;
        if (v != null) activeUserSet.add(v as number);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }
  const activeUserIds = Array.from(activeUserSet);
  if (activeUserIds.length === 0) {
    return Response.json({ ok: true, total: 0, sent: 0, failed: 0, error: "У вашего бота ещё никто не открыл диалог — рассылать некому." });
  }

  let leadsQuery = supabase
    .from("leads")
    .select("id, max_user_id, max_chat_id")
    .eq("bot_id", bot_id)
    .not("max_chat_id", "is", null)
    .is("unsubscribed_at", null)
    .is("dm_unreachable_at", null)     // мёртвые chat_id (404) не трогаем
    .in("max_user_id", activeUserIds);
  if (taggedIds) leadsQuery = leadsQuery.in("id", taggedIds);
  const { data: leads } = await leadsQuery.limit(2000);

  type Recipient = { lead_id: string; chat_id: number; user_id: number | null };
  const seen = new Set<number>();
  const recipients: Recipient[] = [];
  for (const l of leads ?? []) {
    const chat = l.max_chat_id as number | null;
    if (chat == null || seen.has(chat)) continue;
    seen.add(chat);
    recipients.push({ lead_id: l.id as string, chat_id: chat, user_id: (l.max_user_id as number | null) ?? null });
  }
  const msgText = text.trim();

  // 1) Сначала создаём запись broadcasts, чтобы получить id для click-трекинга
  const { data: rec, error: insErr } = await supabase
    .from("broadcasts")
    .insert({
      tenant_id: tenantId,
      bot_id,
      text: msgText,
      audience: tagId ? `tag:${tagId}` : "all",
      total: recipients.length,
      sent: 0,
      failed: 0,
      status: "sending",
      button: buttonResolved?.meta ?? null,
    })
    .select("id")
    .single();
  if (insErr || !rec) return Response.json({ error: insErr?.message ?? "Не удалось создать рассылку" }, { status: 500 });
  const broadcastId = rec.id as string;

  // 2) Оборачиваем кнопку в /bc/<id>/click для подсчёта кликов
  const buttons: SendButton[] | undefined = buttonResolved
    ? [{ text: buttonResolved.text, url: `${APP_URL}/bc/${broadcastId}/click?to=${encodeURIComponent(buttonResolved.target_url)}` }]
    : undefined;

  // 3) Заводим recipients-строки, а потом уже шлём (чтобы ничего не потерять при падении)
  if (recipients.length) {
    await supabase.from("broadcast_recipients").insert(
      recipients.map((r) => ({
        broadcast_id: broadcastId,
        bot_id,
        lead_id: r.lead_id,
        max_chat_id: r.chat_id,
        max_user_id: r.user_id,
      })),
    );
  }

  const token: string = botToken;   // TS не пропускает нарровинг сквозь closure/фон

  // Фоновая отправка. Client получает id немедленно и опрашивает /progress.
  // Прогресс пишется в broadcasts.sent/failed батчами по мере продвижения.
  runBroadcastAsync({
    supabase, broadcastId, tenantId, botId: bot_id as string, platform, token,
    buttons, msgText, media, recipients, tagId,
    auditRequest: request,
  }).catch(async (e) => {
    console.error("broadcast async failed", broadcastId, e);
    await supabase.from("broadcasts").update({ status: "failed" }).eq("id", broadcastId).then(() => {});
  });

  return Response.json({ ok: true, id: broadcastId, total: recipients.length, status: "sending" });
}

// ============================ background sender ============================

type BgMedia = { kind: "image" | "video" | "audio" | "video_note" | "file" | "sticker"; token: string };
type BgArgs = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  broadcastId: string;
  tenantId: string;
  botId: string;
  platform: "max" | "telegram";
  token: string;
  buttons: SendButton[] | undefined;
  msgText: string;
  media: BgMedia | null;
  recipients: Array<{ lead_id: string; chat_id: number; user_id: number | null }>;
  tagId: string | null;
  auditRequest: Request;
};

async function runBroadcastAsync(args: BgArgs): Promise<void> {
  const { supabase, broadcastId, tenantId, botId, platform, token, buttons, msgText, media, recipients, tagId, auditRequest } = args;

  // Параллельная отправка пачками. MAX лимит ~30 rps → concurrency 12 даёт ~20-25 rps.
  const CONCURRENCY = 12;
  let sent = 0, failed = 0;
  const deliveredChats: number[] = [];
  const dialogRows: Array<Record<string, unknown>> = [];

  // Пробуем до 3 раз с backoff — тонкие 429/5xx/сетевые обычно проходят со второй попытки.
  // Реально dead chat_id (404) отсекаем сразу без ретраев.
  const deadLeadIds: string[] = [];

  const sendOne = async (r: { lead_id: string; chat_id: number; user_id: number | null }): Promise<void> => {
    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      try {
        const res = await botSendMessage(platform, token, r.chat_id, msgText, { markdown: true, buttons, media });
        if (res.ok) {
          sent++;
          deliveredChats.push(r.chat_id);
          if (r.user_id != null) {
            dialogRows.push({
              tenant_id: tenantId, bot_id: botId, max_user_id: r.user_id,
              max_chat_id: r.chat_id, direction: "out", text: msgText,
            });
          }
          return;
        }
        // 404 — chat.not.found → диалог удалён, chat_id мёртв, помечаем лид
        if (res.status === 404) {
          deadLeadIds.push(r.lead_id);
          failed++;
          return;
        }
        if (res.status === 403) { failed++; return; }
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        failed++;
      } catch {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        failed++;
      }
    }
  };

  // прогресс апдейтим каждые ~2 секунды через .update() — legkie SQL
  let lastPersist = 0;
  const persistProgress = async () => {
    const now = Date.now();
    if (now - lastPersist < 2000) return;
    lastPersist = now;
    await supabase.from("broadcasts").update({ sent, failed }).eq("id", broadcastId);
  };

  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const batch = recipients.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(sendOne));
    await persistProgress();
  }

  // финализация: отмечаем delivered / вставляем dialog_messages / status=done
  if (deliveredChats.length) {
    const nowIso = new Date().toISOString();
    for (let i = 0; i < deliveredChats.length; i += 500) {
      await supabase.from("broadcast_recipients")
        .update({ delivered: true, delivered_at: nowIso })
        .eq("broadcast_id", broadcastId)
        .in("max_chat_id", deliveredChats.slice(i, i + 500));
    }
  }
  if (dialogRows.length) {
    for (let i = 0; i < dialogRows.length; i += 500) {
      await supabase.from("dialog_messages").insert(dialogRows.slice(i, i + 500));
    }
  }
  // помечаем dead-лидов, чтобы следующие рассылки их не считали
  if (deadLeadIds.length) {
    const nowIso = new Date().toISOString();
    for (let i = 0; i < deadLeadIds.length; i += 500) {
      await supabase.from("leads")
        .update({ dm_unreachable_at: nowIso })
        .in("id", deadLeadIds.slice(i, i + 500))
        .is("dm_unreachable_at", null);
    }
  }
  await supabase.from("broadcasts")
    .update({ sent, failed, status: "done" }).eq("id", broadcastId);

  try {
    await audit(supabase, auditRequest, {
      tenantId,
      action: "broadcast.send",
      targetType: "broadcast",
      targetId: broadcastId,
      after: { bot_id: botId, total: recipients.length, sent, failed, audience: tagId ? `tag:${tagId}` : "all" },
    });
  } catch { /* audit не критичен */ }
}
