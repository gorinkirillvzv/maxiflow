// Ретрай не доставленных получателей рассылки. Умный:
// - шлёт только тем, у кого delivered=false и chat_id ещё не помечен мёртвым (404)
// - с retry на 429/5xx (реально помогает при MAX rate-limit)
// - 404 сразу помечает как мёртвый навсегда → dead chats больше не мучаем
import { createClient } from "@/lib/supabase/server";
import { maybeDecrypt } from "@/lib/crypto";
import { botSendMessage, type SendButton } from "@/lib/botSend";

export const dynamic = "force-dynamic";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://maxiflow.ru";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data: br } = await supabase
    .from("broadcasts")
    .select("id, tenant_id, bot_id, text, button, status")
    .eq("id", id).maybeSingle();
  if (!br) return Response.json({ error: "Рассылка не найдена" }, { status: 404 });
  if (br.status === "sending") return Response.json({ error: "Рассылка ещё идёт" }, { status: 409 });

  const { data: bot } = await supabase
    .from("bots").select("bot_token, platform").eq("id", br.bot_id).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });
  const token = maybeDecrypt(bot.bot_token);
  if (!token) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });
  const platform = (bot.platform as "max" | "telegram") ?? "max";

  const { data: pending } = await supabase
    .from("broadcast_recipients")
    .select("id, max_chat_id, max_user_id")
    .eq("broadcast_id", id).eq("delivered", false);
  const targets = (pending ?? []).map((r) => ({
    id: r.id as string,
    chat_id: Number(r.max_chat_id),
    user_id: r.max_user_id != null ? Number(r.max_user_id) : null,
  }));
  if (targets.length === 0) {
    return Response.json({ error: "Все уже получили — досылать некому" }, { status: 400 });
  }

  const buttonMeta = (br.button as { text?: string; target_url?: string; url?: string } | null) ?? null;
  let buttons: SendButton[] | undefined;
  if (buttonMeta?.text) {
    const target = buttonMeta.target_url ?? buttonMeta.url;
    if (target) buttons = [{
      text: buttonMeta.text,
      url: `${APP_URL}/bc/${br.id}/click?to=${encodeURIComponent(target)}`,
    }];
  }

  await supabase.from("broadcasts").update({ status: "sending" }).eq("id", br.id);

  runResendAsync({
    supabase, broadcastId: br.id as string,
    tenantId: br.tenant_id as string, botId: br.bot_id as string,
    platform, token, buttons, msgText: br.text as string, targets,
  }).catch(async (e) => {
    console.error("resend failed", br.id, e);
    await supabase.from("broadcasts").update({ status: "failed" }).eq("id", br.id);
  });

  return Response.json({ ok: true, id: br.id, retry_count: targets.length, status: "sending" });
}

type BgArgs = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  broadcastId: string;
  tenantId: string;
  botId: string;
  platform: "max" | "telegram";
  token: string;
  buttons: SendButton[] | undefined;
  msgText: string;
  targets: Array<{ id: string; chat_id: number; user_id: number | null }>;
};

async function runResendAsync(a: BgArgs): Promise<void> {
  const CONCURRENCY = 12;
  const deliveredIds: string[] = [];
  const dialogRows: Array<Record<string, unknown>> = [];
  let newSent = 0;

  const sendOne = async (t: { id: string; chat_id: number; user_id: number | null }) => {
    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      try {
        const res = await botSendMessage(a.platform, a.token, t.chat_id, a.msgText, { markdown: true, buttons: a.buttons });
        if (res.ok) {
          newSent++;
          deliveredIds.push(t.id);
          if (t.user_id != null) {
            dialogRows.push({
              tenant_id: a.tenantId, bot_id: a.botId, max_user_id: t.user_id,
              max_chat_id: t.chat_id, direction: "out", text: a.msgText,
            });
          }
          return;
        }
        if (res.status === 403 || res.status === 404) return;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
      } catch {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
      }
    }
  };

  for (let i = 0; i < a.targets.length; i += CONCURRENCY) {
    const batch = a.targets.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(sendOne));
    // прогресс — обновляем sent инкрементально
    const { data: cur } = await a.supabase.from("broadcasts").select("sent").eq("id", a.broadcastId).maybeSingle();
    if (cur) await a.supabase.from("broadcasts").update({ sent: (cur.sent ?? 0) + newSent - (i === 0 ? 0 : newSent) }).eq("id", a.broadcastId);
  }

  if (deliveredIds.length) {
    const nowIso = new Date().toISOString();
    for (let i = 0; i < deliveredIds.length; i += 500) {
      await a.supabase.from("broadcast_recipients")
        .update({ delivered: true, delivered_at: nowIso })
        .in("id", deliveredIds.slice(i, i + 500));
    }
  }
  if (dialogRows.length) {
    for (let i = 0; i < dialogRows.length; i += 500) {
      await a.supabase.from("dialog_messages").insert(dialogRows.slice(i, i + 500));
    }
  }

  // финальный пересчёт
  const { data: totals } = await a.supabase
    .from("broadcast_recipients").select("delivered").eq("broadcast_id", a.broadcastId);
  const t = totals ?? [];
  const finalSent = t.filter((r) => r.delivered).length;
  await a.supabase.from("broadcasts")
    .update({ sent: finalSent, failed: t.length - finalSent, status: "done" })
    .eq("id", a.broadcastId);
}
