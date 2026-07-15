// Посты канала: список существующих (GET) и правка (PUT).
import { maxListMessages, maxEditMessage, maxIsChannelAdmin, botStartUrl, safeButtonUrl, type MaxMediaKind } from "@/lib/maxApi";
import { createClient } from "@/lib/supabase/server";
import { maybeDecrypt } from "@/lib/crypto";

const MEDIA_KINDS: MaxMediaKind[] = ["image", "video", "audio", "video_note", "file", "sticker"];

async function botFor(request: Request, botId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован", status: 401 as const };

  let q = supabase.from("bots").select("id, tenant_id, bot_token, max_bot_username, channel_id, platform");
  q = botId ? q.eq("id", botId) : q.limit(1);
  const { data } = await q;
  const bot = data?.[0];
  if (!bot) return { error: "Бот не найден", status: 404 as const };
  if (!bot.channel_id) return { error: "У бота не привязан канал", status: 400 as const };
  const decryptedToken = maybeDecrypt(bot.bot_token);
  if (!decryptedToken) return { error: "Токен бота недоступен", status: 500 as const };
  return { bot: { ...bot, bot_token: decryptedToken } };
}

export async function GET(request: Request) {
  const botId = new URL(request.url).searchParams.get("bot_id");
  const r = await botFor(request, botId);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });

  // Telegram Bot API не отдаёт историю канала — отдаём пустой список с маркером.
  if (r.bot.platform === "telegram") {
    return Response.json({
      posts: [],
      bot_username: r.bot.max_bot_username,
      platform: "telegram",
      unsupported_reason: "Telegram Bot API не предоставляет историю постов канала. Можно только публиковать новые посты.",
    });
  }

  // Проверяем, что бот действительно админ канала — иначе публикации/правки будут молча
  // проваливаться. Идёт параллельно списку сообщений, чтобы не удлинять ответ.
  const isAdminPromise = maxIsChannelAdmin(r.bot.bot_token, r.bot.channel_id).catch(() => false);

  try {
    const posts = await maxListMessages(r.bot.bot_token, r.bot.channel_id);
    const mids = posts.map((p) => p.mid).filter(Boolean);
    const messagesByMid = new Map<string, string>();
    const archives = new Map<string, {
      raw_text: string | null;
      raw_button_text: string | null;
      disable_link_preview: boolean | null;
    }>();

    if (mids.length > 0) {
      const supabase = await createClient();
      const [campRes, archRes] = await Promise.all([
        supabase
          .from("post_campaigns")
          .select("post_mid, subscribe_message")
          .eq("bot_id", r.bot.id)
          .in("post_mid", mids),
        supabase
          .from("post_archives")
          .select("post_mid, raw_text, raw_button_text, disable_link_preview")
          .eq("bot_id", r.bot.id)
          .in("post_mid", mids),
      ]);
      for (const c of campRes.data ?? []) {
        if (c.post_mid && typeof c.subscribe_message === "string") {
          messagesByMid.set(c.post_mid, c.subscribe_message);
        }
      }
      for (const a of archRes.data ?? []) {
        if (a.post_mid) archives.set(a.post_mid, a);
      }
    }

    const enriched = posts.map((p) => {
      const arch = archives.get(p.mid);
      return {
        ...p,
        // если есть архив — используем оригинальный markdown вместо «сваренного» MAX-текста
        text: arch?.raw_text ?? p.text,
        buttonText: arch?.raw_button_text ?? p.buttonText,
        disableLinkPreview: arch?.disable_link_preview ?? false,
        subscribeMessage: messagesByMid.get(p.mid) ?? null,
      };
    });
    const channel_admin = await isAdminPromise;
    return Response.json({
      posts: enriched,
      bot_username: r.bot.max_bot_username,
      platform: "max",
      channel_admin,
    });
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    const cause = err?.cause;
    const detail = `${err?.message ?? e}` +
      (cause ? ` — ${cause.code ?? ""} ${cause.message ?? JSON.stringify(cause)}` : "");
    console.error("channel-posts GET:", detail);
    return Response.json({ error: `Не удалось получить посты канала: ${detail}` }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const { bot_id, mid, text, with_button, button_text } = body;
  // пустая строка из формы не пройдёт как uuid — считаем её отсутствием привязки
  const funnelId = typeof body.funnel_id === "string" && body.funnel_id.trim()
    ? body.funnel_id.trim()
    : null;
  if (!mid || !text || typeof text !== "string") {
    return Response.json({ error: "Нужны mid и текст" }, { status: 400 });
  }

  const mKind = body.media_kind;
  const mToken = body.media_token;
  const media = (typeof mKind === "string" && typeof mToken === "string" && mToken.trim()
                 && MEDIA_KINDS.includes(mKind as MaxMediaKind))
    ? { kind: mKind as MaxMediaKind, token: mToken.trim() }
    : null;

  const r = await botFor(request, (bot_id as string) ?? null);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });

  const customUrl = safeButtonUrl(body.button_url);
  const subscribeMsg = (() => {
    const v = body.subscribe_message;
    if (typeof v !== "string") return null;
    const s = v.trim();
    if (!s) return null;
    return s.length > 2000 ? s.slice(0, 2000) : s;
  })();
  // Явный выбор: true=мини-апп (?startapp=pc_...), false=прямая ссылка в бот (?start=...).
  // Для обратной совместимости: если поле не пришло — включаем мини-апп, только если есть subscribeMsg.
  const useMiniapp = typeof body.use_miniapp === "boolean" ? body.use_miniapp : !!subscribeMsg;

  // воронка, которую запустит кнопка лид-магнита (если не используем произвольную ссылку)
  let funnelTrigger: string | null = null;
  if (!customUrl && funnelId) {
    const supabase = await createClient();
    const { data: f } = await supabase
      .from("funnels").select("trigger_command")
      .eq("id", funnelId).eq("bot_id", r.bot.id).maybeSingle();
    funnelTrigger = f?.trigger_command ?? null;
  }

  // post_campaign (мини-апп режим) заводим только когда явно включён мини-апп
  let campaignId: string | null = null;
  if (with_button && !customUrl && useMiniapp && subscribeMsg) {
    const supabase = await createClient();
    // ищем уже существующую кампанию для этого mid
    const { data: existing } = await supabase
      .from("post_campaigns")
      .select("id")
      .eq("bot_id", r.bot.id)
      .eq("post_mid", mid as string)
      .maybeSingle();
    if (existing) {
      campaignId = existing.id as string;
      await supabase.from("post_campaigns")
        .update({ subscribe_message: subscribeMsg, funnel_id: funnelId })
        .eq("id", campaignId);
    } else {
      const a = Math.random().toString(16).slice(2, 8).padEnd(6, "0");
      const b = (Date.now() & 0xffffff).toString(16).padStart(6, "0");
      campaignId = `${a}${b}`;
      const { error: cErr } = await supabase.from("post_campaigns").insert({
        id: campaignId,
        tenant_id: r.bot.tenant_id ?? null,
        bot_id: r.bot.id,
        post_mid: mid as string,
        subscribe_message: subscribeMsg,
        funnel_id: funnelId,
      });
      if (cErr) {
        return Response.json({ error: `campaign upsert: ${cErr.message}` }, { status: 500 });
      }
    }
  }

  const buttonLabel = (typeof button_text === "string" && button_text.trim()) || "Получить материал";
  const universalBot = process.env.NEXT_PUBLIC_MAXIFLOW_BOT_USERNAME || r.bot.max_bot_username;
  const buttons = with_button
    ? customUrl
      ? [[{ type: "link" as const, text: buttonLabel, url: customUrl }]]
      : campaignId
        ? [[{ type: "link" as const, text: buttonLabel, url: `https://max.ru/${universalBot}?startapp=pc_${campaignId}` }]]
        : [[{ type: "link" as const, text: buttonLabel, url: botStartUrl(r.bot.max_bot_username, funnelTrigger) }]]
    : undefined;

  const disableLinkPreview = body.disable_link_preview === true;
  const res = await maxEditMessage(r.bot.bot_token, mid as string, text, buttons, "markdown", media,
    disableLinkPreview ? { disableLinkPreview: true } : undefined);
  if (!res.ok) {
    return Response.json({ error: `MAX отклонил правку (${res.status})` }, { status: 502 });
  }

  // обновляем архив оригинального текста
  try {
    const supabase = await createClient();
    await supabase.from("post_archives").upsert({
      bot_id: r.bot.id,
      tenant_id: r.bot.tenant_id ?? null,
      post_mid: mid as string,
      raw_text: text,
      raw_button_text: buttonLabel,
      disable_link_preview: disableLinkPreview ? true : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "bot_id,post_mid" });
  } catch (e) {
    console.error("post_archives upsert failed", e);
  }

  return Response.json({ ok: true });
}
