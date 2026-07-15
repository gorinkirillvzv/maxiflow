// Публикатор отложенных постов. Дёргается systemd-таймером на VPS раз в минуту.
// Авторизация: заголовок x-cron-key === process.env.CRON_SECRET.
import { maxSendMessage, botStartUrl, type MaxTextFormat, type MaxMediaKind } from "@/lib/maxApi";
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeDecrypt } from "@/lib/crypto";

const MEDIA_KINDS: MaxMediaKind[] = ["image", "video", "audio", "video_note", "file", "sticker"];

export async function POST(request: Request) {
  const key = request.headers.get("x-cron-key");
  if (!key || !process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // созревшие посты
  const { data: due } = await admin
    .from("scheduled_posts")
    .select("id, tenant_id, bot_id, text, button_text, format, funnel_id, button_url, media_kind, media_token, subscribe_message, disable_link_preview")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (!due || due.length === 0) {
    return Response.json({ published: 0, failed: 0 });
  }

  let published = 0;
  let failed = 0;

  for (const post of due) {
    // claim: помечаем 'sending' только если ещё 'pending' (защита от двойного запуска)
    const { data: claimed } = await admin
      .from("scheduled_posts")
      .update({ status: "sending" })
      .eq("id", post.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const fail = async (msg: string) => {
      await admin.from("scheduled_posts")
        .update({ status: "failed", error: msg }).eq("id", post.id);
      failed++;
    };

    const { data: bot } = await admin
      .from("bots")
      .select("bot_token, max_bot_username, channel_id")
      .eq("id", post.bot_id)
      .single();

    if (!bot || !bot.channel_id) {
      await fail("у бота не привязан канал");
      continue;
    }
    const botToken = maybeDecrypt(bot.bot_token);
    if (!botToken) {
      await fail("токен бота недоступен");
      continue;
    }

    const customUrl = typeof post.button_url === "string" && /^https?:\/\//i.test(post.button_url)
      ? post.button_url
      : null;
    const subscribeMsg = typeof post.subscribe_message === "string" && post.subscribe_message.trim()
      ? post.subscribe_message.trim().slice(0, 2000)
      : null;

    // воронка для deeplink (если кнопка не на произвольный URL)
    let funnelTrigger: string | null = null;
    if (!customUrl && post.funnel_id) {
      const { data: f } = await admin
        .from("funnels").select("trigger_command").eq("id", post.funnel_id).maybeSingle();
      funnelTrigger = f?.trigger_command ?? null;
    }

    // создаём post_campaign если задан subscribe_message
    let campaignId: string | null = null;
    if (post.button_text && !customUrl && subscribeMsg) {
      const a = Math.random().toString(16).slice(2, 8).padEnd(6, "0");
      const b = (Date.now() & 0xffffff).toString(16).padStart(6, "0");
      campaignId = `${a}${b}`;
      await admin.from("post_campaigns").insert({
        id: campaignId,
        tenant_id: post.tenant_id,
        bot_id: post.bot_id,
        subscribe_message: subscribeMsg,
        funnel_id: post.funnel_id,
      });
    }

    const universalBot = process.env.NEXT_PUBLIC_MAXIFLOW_BOT_USERNAME || bot.max_bot_username;
    const buttons = post.button_text
      ? customUrl
        ? [[{ type: "link" as const, text: post.button_text, url: customUrl }]]
        : campaignId
          ? [[{ type: "link" as const, text: post.button_text, url: `https://max.ru/${universalBot}?startapp=pc_${campaignId}` }]]
          : [[{ type: "link" as const, text: post.button_text, url: botStartUrl(bot.max_bot_username, funnelTrigger) }]]
      : undefined;

    const media = (typeof post.media_kind === "string" && typeof post.media_token === "string"
                   && post.media_token.trim()
                   && MEDIA_KINDS.includes(post.media_kind as MaxMediaKind))
      ? { kind: post.media_kind as MaxMediaKind, token: post.media_token as string }
      : null;

    try {
      const res = await maxSendMessage(
        botToken, bot.channel_id, post.text, buttons,
        (post.format as MaxTextFormat) ?? "markdown",
        media,
        post.disable_link_preview ? { disableLinkPreview: true } : undefined,
      );
      if (res.ok) {
        await admin.from("scheduled_posts")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", post.id);
        // достаём mid и архивируем оригинал
        const respBody = (res.body as Record<string, unknown> | null) ?? null;
        const message = (respBody?.message ?? {}) as Record<string, unknown>;
        const bodyObj = (message.body ?? {}) as Record<string, unknown>;
        const publishedMid = typeof bodyObj.mid === "string" ? bodyObj.mid : null;
        if (publishedMid) {
          await admin.from("post_archives").upsert({
            bot_id: post.bot_id,
            tenant_id: post.tenant_id,
            post_mid: publishedMid,
            raw_text: post.text,
            raw_button_text: post.button_text,
            disable_link_preview: post.disable_link_preview ?? null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "bot_id,post_mid" });
        }
        // привязка mid к кампании
        if (campaignId) {
          const respBody = (res.body as Record<string, unknown> | null) ?? null;
          const message = (respBody?.message ?? {}) as Record<string, unknown>;
          const bodyObj = (message.body ?? {}) as Record<string, unknown>;
          const newMid = typeof bodyObj.mid === "string" ? bodyObj.mid : null;
          if (newMid) {
            await admin.from("post_campaigns").update({ post_mid: newMid }).eq("id", campaignId);
          }
        }
        published++;
      } else {
        await fail(`MAX отклонил публикацию (${res.status})`);
      }
    } catch (e) {
      await fail(e instanceof Error ? e.message : "сетевая ошибка");
    }
  }

  return Response.json({ published, failed });
}
